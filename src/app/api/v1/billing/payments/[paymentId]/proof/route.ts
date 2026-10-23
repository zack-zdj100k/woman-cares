import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/server/services/admin-users";
import { readPaymentProof } from "@/server/services/payment-proofs";

/** GET: the proof a professional attached to her declaration (Super Admins, or herself). Downloaded, never cached. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/v1/billing/payments/[paymentId]/proof">) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { paymentId } = await ctx.params;
  try {
    const { data, pdf, name } = await readPaymentProof(user, paymentId);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": pdf ? "application/pdf" : "image/webp",
        "Content-Disposition": `inline; filename="${name}.${pdf ? "pdf" : "webp"}"`,
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
