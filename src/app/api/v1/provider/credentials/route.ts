import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/auth/origin";
import { rateLimit } from "@/lib/rate-limit";
import { ForbiddenError } from "@/server/services/admin-users";
import { LockedError } from "@/server/services/provider-profiles";
import { UploadRejected } from "@/server/services/media";
import { CREDENTIAL_TYPES, MAX_CREDENTIAL_BYTES, addCredential, type CredentialType } from "@/server/services/credentials";

const error = (status: number, code: string) => NextResponse.json({ error: { code } }, { status });

/** POST /api/v1/provider/credentials (multipart: file, category, type, issuer?, expiresAt?). Private storage. */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error(403, "ORIGIN");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!length || length > MAX_CREDENTIAL_BYTES + 64 * 1024) return error(413, "TOO_LARGE");
  const user = await getSessionUser();
  if (!user) return error(401, "UNAUTHENTICATED");
  if (!rateLimit(`credential:${user.id}`, 20, 60 * 60_000).ok) return error(429, "RATE_LIMITED");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(400, "BAD_FORM");
  }
  const file = form.get("file");
  const type = String(form.get("type") ?? "");
  const category = String(form.get("category") ?? "");
  const expiresAt = String(form.get("expiresAt") ?? "");
  if (!(file instanceof File)) return error(400, "NO_FILE");
  if (!(CREDENTIAL_TYPES as readonly string[]).includes(type) || !/^[a-z-]{2,40}$/.test(category)) return error(400, "BAD_FORM");
  if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) return error(400, "BAD_FORM");

  try {
    const created = await addCredential(
      user,
      { categorySlug: category, type: type as CredentialType, issuer: String(form.get("issuer") ?? "").trim() || null, expiresAt: expiresAt || null },
      Buffer.from(await file.arrayBuffer()),
    );
    return NextResponse.json({ data: { id: created.id } }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return error(404, "NOT_FOUND");
    if (e instanceof LockedError) return error(409, "LOCKED");
    if (e instanceof UploadRejected) return error(422, e.reason.toUpperCase());
    throw e;
  }
}
