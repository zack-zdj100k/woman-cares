import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { isLocale } from "@/i18n/config";
import { renderEmail, type TemplateData } from "@/lib/email/templates";
import type { Role } from "@/server/policies/roles";
import { enqueueEmail } from "./outbox";

/**
 * Alerts for the team: an in-app notification for each staff member with one of `roles`, and an
 * email for those with one of `emailRoles` (by default the Super Admins only). Written in the same
 * transaction as the event, in each recipient's language; the outbox delivers the emails.
 */
export async function notifyStaff(
  tx: Prisma.TransactionClient,
  alert: { kind: NonNullable<TemplateData["kind"]>; path: string; data: Omit<TemplateData, "name" | "url" | "kind">; dedupeKey: string },
  roles: Role[] = ["SUPER_ADMIN", "ADMIN"],
  emailRoles: Role[] = ["SUPER_ADMIN"],
) {
  const staff = await tx.user.findMany({ where: { role: { in: [...new Set([...roles, ...emailRoles])] }, status: "ACTIVE" }, select: { id: true, email: true, fullName: true, locale: true, role: true } });
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  for (const u of staff) {
    const locale = isLocale(u.locale) ? u.locale : "fr";
    const data: TemplateData = { ...alert.data, kind: alert.kind, name: u.fullName.split(" ")[0], url: `${base}/${locale}${alert.path}` };
    const rendered = renderEmail("staff-alert", locale, data);
    if (roles.includes(u.role)) {
      await tx.notification.create({
        data: { userId: u.id, type: `staff.${alert.kind}`, title: rendered.subject, body: rendered.text.split("\n").filter(Boolean)[1] ?? rendered.subject, data: { path: alert.path, key: alert.dedupeKey } },
      });
    }
    if (emailRoles.includes(u.role)) await enqueueEmail(tx, { to: u.email, template: "staff-alert", locale, data, dedupeKey: `${alert.dedupeKey}:${u.id}` });
  }
}
