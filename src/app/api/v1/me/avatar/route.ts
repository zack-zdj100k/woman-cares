import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/auth/origin";
import { rateLimit } from "@/lib/rate-limit";
import { setMyAvatar } from "@/server/services/account";
import { UploadRejected } from "@/server/services/media";

const error = (status: number, code: string) => NextResponse.json({ error: { code } }, { status });

/** POST /api/v1/me/avatar (multipart: file) sets the signed-in user's picture; DELETE removes it. */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error(403, "ORIGIN");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!length || length > 5 * 1024 * 1024 + 64 * 1024) return error(413, "TOO_LARGE");
  const user = await getSessionUser();
  if (!user) return error(401, "UNAUTHENTICATED");
  if (!rateLimit(`avatar:${user.id}`, 20, 60 * 60_000).ok) return error(429, "RATE_LIMITED");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(400, "BAD_FORM");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return error(400, "NO_FILE");
  try {
    await setMyAvatar(user, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ data: { ok: true } }, { status: 201 });
  } catch (e) {
    if (e instanceof UploadRejected) return error(422, e.reason.toUpperCase());
    throw e;
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return error(403, "ORIGIN");
  const user = await getSessionUser();
  if (!user) return error(401, "UNAUTHENTICATED");
  await setMyAvatar(user, null);
  return NextResponse.json({ data: { ok: true } });
}
