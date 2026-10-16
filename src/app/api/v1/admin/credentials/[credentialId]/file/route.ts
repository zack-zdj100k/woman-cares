import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/server/services/admin-users";
import { readCredentialFile } from "@/server/services/credentials";

/**
 * GET /api/v1/admin/credentials/{id}/file. ADMIN+ only; every opening is audited.
 * Never cached; PDFs are downloaded rather than rendered in the page; sandboxed and nosniff.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/v1/admin/credentials/[credentialId]/file">) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { credentialId } = await ctx.params;
  try {
    const { data, pdf } = await readCredentialFile(user, credentialId);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": pdf ? "application/pdf" : "image/webp",
        "Content-Disposition": pdf ? `attachment; filename="justificatif-${credentialId.slice(0, 8)}.pdf"` : "inline",
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
