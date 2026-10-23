import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/auth/origin";
import { rateLimit } from "@/lib/rate-limit";
import { ForbiddenError } from "@/server/services/admin-users";
import { BillingBlocked, declarePayment } from "@/server/services/billing";
import { UploadRejected } from "@/server/services/media";
import { PROOF_MAX_BYTES } from "@/server/services/payment-proofs";
import { deliverPendingEmails } from "@/server/services/outbox";

const error = (status: number, code: string) => NextResponse.json({ error: { code } }, { status });
const METHODS = ["MANUAL_TRANSFER", "CCP", "BARIDIMOB", "CASH"] as const;

/** POST (multipart: method, reference, note?, key, file?): the professional declares her transfer, with a proof. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/v1/billing/invoices/[invoiceId]/declare">) {
  if (!sameOrigin(request)) return error(403, "ORIGIN");
  if (Number(request.headers.get("content-length") ?? 0) > PROOF_MAX_BYTES + 64 * 1024) return error(413, "SIZE");
  const user = await getSessionUser();
  if (!user) return error(401, "UNAUTHENTICATED");
  if (!rateLimit(`declare:${user.id}`, 10, 60 * 60_000).ok) return error(429, "RATE");
  const { invoiceId } = await ctx.params;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(400, "BAD_FORM");
  }
  const m = String(form.get("method") ?? "");
  const file = form.get("file");
  try {
    await declarePayment(user, invoiceId, {
      method: (METHODS as readonly string[]).includes(m) ? (m as (typeof METHODS)[number]) : "MANUAL_TRANSFER",
      reference: String(form.get("reference") ?? ""),
      note: String(form.get("note") ?? "") || null,
      idempotencyKey: String(form.get("key") ?? ""),
      proof: file instanceof File && file.size > 0 ? Buffer.from(await file.arrayBuffer()) : null,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return error(404, "NOT_FOUND");
    if (e instanceof UploadRejected) return error(422, e.reason.toUpperCase());
    if (e instanceof BillingBlocked) return error(422, e.reason.toUpperCase());
    throw e;
  }
  after(() => deliverPendingEmails().catch(() => {}));
  return NextResponse.json({ data: { ok: true } }, { status: 201 });
}
