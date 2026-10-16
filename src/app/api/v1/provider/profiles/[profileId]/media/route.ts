import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/auth/origin";
import { rateLimit } from "@/lib/rate-limit";
import { ForbiddenError } from "@/server/services/admin-users";
import { LockedError } from "@/server/services/provider-profiles";
import { MAX_VIDEO_BYTES, UploadRejected, addPortfolioMedia } from "@/server/services/media";

const error = (status: number, code: string) => NextResponse.json({ error: { code } }, { status });

/**
 * POST /api/v1/provider/profiles/{profileId}/media (multipart: file, alt?)
 * Owner only. The file type is detected from its bytes, images are re-encoded, videos container-checked.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v1/provider/profiles/[profileId]/media">) {
  if (!sameOrigin(request)) return error(403, "ORIGIN");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!length || length > MAX_VIDEO_BYTES + 64 * 1024) return error(413, "TOO_LARGE");

  const user = await getSessionUser();
  if (!user) return error(401, "UNAUTHENTICATED");
  if (!rateLimit(`upload:${user.id}`, 60, 60 * 60_000).ok) return error(429, "RATE_LIMITED");

  const { profileId } = await ctx.params;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(400, "BAD_FORM");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return error(400, "NO_FILE");
  const alt = typeof form.get("alt") === "string" ? String(form.get("alt")) : null;

  try {
    const { id, tags } = await addPortfolioMedia(user, profileId, Buffer.from(await file.arrayBuffer()), alt);
    for (const tag of tags) revalidateTag(tag, { expire: 0 });
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return error(404, "NOT_FOUND");
    if (e instanceof LockedError) return error(409, "LOCKED");
    if (e instanceof UploadRejected) return error(422, e.reason.toUpperCase());
    throw e;
  }
}
