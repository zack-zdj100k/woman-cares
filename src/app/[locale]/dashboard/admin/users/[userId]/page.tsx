import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getAdminDictionary, getAuthDictionary } from "@/i18n/get-dictionary";
import { requireArea } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { canManageCatalog } from "@/server/policies/roles";
import { ForbiddenError, getUserDetail } from "@/server/services/admin-users";
import { AdminCard, AdminTitle, Chip, ReadOnlyNote, adminPage } from "@/components/admin/admin-ui";
import { ManageForm } from "@/components/admin/manage-form";
import { DecisionFeedback } from "@/components/ui/decision-feedback";
import { fieldClass } from "@/components/ui/field-class";

type Params = PageProps<"/[locale]/dashboard/admin/users/[userId]">["params"];

export const metadata: Metadata = { robots: { index: false } };

export default function UserPage({ params }: { params: Params }) {
  return (
    <>
      <UserFile params={params} />
    </>
  );
}

async function UserFile({ params }: { params: Params }) {
  const { locale: l, userId } = await params;
  if (!isLocale(l)) notFound();
  const locale: Locale = l;
  const actor = await requireArea(locale, "admin", `/${locale}/dashboard/admin/users/${userId}`);
  let data: Awaited<ReturnType<typeof getUserDetail>>;
  try {
    data = await getUserDetail(actor, userId);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
  const [at, t] = await Promise.all([getAdminDictionary(locale), getAuthDictionary(locale)]);
  const { user, roles, canSuspend, canRestore, history } = data;
  const c = at.user;
  const self = user.id === actor.id;
  const labels = { done: at.manage.done, errors: at.manage.errors };
  const when = (d: Date | null) => (d ? formatDate(d, locale, { dateStyle: "medium", timeStyle: "short" }) : c.never);
  const facts: [string, ReactNode][] = [
    [c.email, <bdi key="e" dir="ltr">{user.email}</bdi>],
    [c.phone, <bdi key="p" dir="ltr">{user.phone ?? "-"}</bdi>],
    [c.language, c.languages[user.locale] ?? user.locale],
    [c.joined, formatDate(user.createdAt, locale, { dateStyle: "long" })],
    [c.lastLogin, when(user.lastLoginAt)],
    [c.sessions, user._count.sessions],
    [c.bookings, user._count.bookings],
  ];
  if (user.lockedUntil && user.lockedUntil > new Date()) facts.push([c.locked, when(user.lockedUntil)]);

  return (
    <div className={adminPage}>
      <AdminTitle title={user.fullName} back={{ href: `/${locale}/dashboard/admin/users`, label: c.back }} />
      <p className="mt-4 flex flex-wrap items-center gap-2">
        <Chip tone={user.role === "CLIENT" || user.role === "PROVIDER" ? "quiet" : "ink"}>{at.roles[user.role]}</Chip>
        <Chip tone={user.status === "SUSPENDED" || user.status === "DEACTIVATED" ? "rose" : "quiet"}>{at.userStatuses[user.status]}</Chip>
        <Chip>{user.emailVerifiedAt ? c.emailVerified : c.emailNotVerified}</Chip>
      </p>
      {!canManageCatalog(actor) && <ReadOnlyNote>{at.manage.readOnly}</ReadOnlyNote>}

      <DecisionFeedback>
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <AdminCard title={c.identity}>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-sm text-ink-2">{k}</dt>
                  <dd className="mt-0.5 break-words">{v}</dd>
                </div>
              ))}
            </dl>
            {user.provider && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-surface p-4">
                <div>
                  <p className="text-sm text-ink-2">{c.provider}</p>
                  <p className="font-medium">
                    {user.provider.businessName} · {t.dashboard.provider.statuses[user.provider.status]}
                  </p>
                </div>
                <Link href={`/${locale}/dashboard/admin/providers/${user.provider.id}`} className="text-sm underline underline-offset-4 hover:text-rose-ink">
                  {c.openProvider}
                </Link>
              </div>
            )}
          </AdminCard>

          <div className="grid content-start gap-6">
            <AdminCard title={c.role}>
              {roles.length > 0 ? (
                <ManageForm
                  op="user.role"
                  id={user.id}
                  label={c.changeRole}
                  labels={labels}
                  tone="solid"
                  fields={
                    <>
                      <p className="text-sm leading-relaxed text-ink-2">{c.roleHelp}</p>
                      <label className="mt-2 grid gap-1.5 text-sm font-medium">
                        {c.newRole}
                        <select name="role" required defaultValue="" className={cn(fieldClass, "border-ink/20 font-normal")}>
                          <option value="" disabled>
                            {c.chooseRole}
                          </option>
                          {roles.map((r) => (
                            <option key={r} value={r}>
                              {at.roles[r]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  }
                />
              ) : (
                <p className="text-sm leading-relaxed text-ink-2">{self ? c.roleSelf : c.roleLocked}</p>
              )}
            </AdminCard>

            <AdminCard title={c.status}>
              <p className="mb-4 text-sm leading-relaxed text-ink-2">{c.statusHelp}</p>
              {canSuspend && <ManageForm op="user.suspend" id={user.id} label={c.suspend} labels={labels} tone="danger" note={{ label: c.reason, placeholder: c.reasonPlaceholder }} />}
              {canRestore && <ManageForm op="user.restore" id={user.id} label={c.restore} labels={labels} tone="solid" />}
              {!canSuspend && !canRestore && <p className="text-sm text-ink-2">{self ? c.statusSelf : c.statusLocked}</p>}
            </AdminCard>
          </div>
        </div>

        {history && (
          <AdminCard title={c.history} className="mt-6">
            {history.length === 0 ? (
              <p className="text-ink-2">{c.noHistory}</p>
            ) : (
              <ul className="divide-y divide-line">
                {history.map((h) => {
                  const m = (h.metadata ?? {}) as Record<string, unknown>;
                  const detail =
                    h.action === "user.role.change"
                      ? `${at.roles[String(m.from)] ?? m.from} ${locale === "ar" ? "←" : "→"} ${at.roles[String(m.to)] ?? m.to}`
                      : typeof m.reason === "string" && m.reason
                        ? m.reason
                        : null;
                  return (
                    <li key={h.id} className="py-3 text-sm">
                      <p>
                        <span className="font-medium">{at.audit[h.action] ?? h.action}</span>
                        {detail && <span className="text-ink-2"> · {detail}</span>}
                      </p>
                      <p className="text-ink-2">
                        {when(h.createdAt)} · {c.by} {h.actor ? `${h.actor.fullName} (${at.roles[h.actor.role]})` : c.system}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </AdminCard>
        )}
      </DecisionFeedback>
    </div>
  );
}
