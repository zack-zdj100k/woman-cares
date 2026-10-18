import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/auth/origin";
import { rateLimit } from "@/lib/rate-limit";
import { ForbiddenError } from "@/server/services/admin-users";
import { BillingBlocked } from "@/server/services/billing";
import { UploadRejected } from "@/server/services/media";
import { attachReceipt, readReceipt } from "@/server/services/receipts";

const error = (status: number, code: string) => NextResponse.json({ error: { code } }, { status });
const day = (v: FormDataEntryValue | null) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00+01:00`) : null);

/** GET: the receipt file (staff, or the professional it belongs to). Never cached, downloaded. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/v1/billing/payments/[paymentId]/receipt">) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { paymentId } = await ctx.params;
  try {
    const { data, pdf, name } = await readReceipt(user, paymentId);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": pdf ? "application/pdf" : "image/webp",
        "Content-Disposition": `attachment; filename="${name}.${pdf ? "pdf" : "webp"}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return new NextResponse(null, { status: 404 });
    throw e;
  }
}

/** POST (multipart: file?, note?, from?, to?): ADMIN and above attach a receipt to a paid payment. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v1/billing/payments/[paymentId]/receipt">) {
  if (!sameOrigin(request)) return error(403, "ORIGIN");
  if (Number(request.headers.get("content-length") ?? 0) > 10 * 1024 * 1024 + 64 * 1024) return error(413, "TOO_LARGE");
  const user = await getSessionUser();
  if (!user) return error(401, "UNAUTHENTICATED");
  if (!rateLimit(`receipt:${user.id}`, 60, 60 * 60_000).ok) return error(429, "RATE_LIMITED");
  const { paymentId } = await ctx.params;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(400, "BAD_FORM");
  }
  const file = form.get("file");
  try {
    await attachReceipt(user, paymentId, {
      file: file instanceof File && file.size > 0 ? Buffer.from(await file.arrayBuffer()) : null,
      note: typeof form.get("note") === "string" ? String(form.get("note")) : null,
      coveredFrom: day(form.get("from")),
      coveredTo: day(form.get("to")),
    });
    return NextResponse.json({ data: { ok: true } }, { status: 201 });
  } catch (e) {
    if (e instanceof ForbiddenError) return error(404, "NOT_FOUND");
    if (e instanceof UploadRejected) return error(422, e.reason.toUpperCase());
    if (e instanceof BillingBlocked) return error(422, e.reason.toUpperCase());
    throw e;
  }
}
