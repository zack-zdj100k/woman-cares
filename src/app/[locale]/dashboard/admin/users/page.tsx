import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { isLocale, type Locale } from "@/i18n/config";
import { getAdminDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ROLES, type Role, type Status } from "@/server/policies/roles";
import { listUsers } from "@/server/services/admin-users";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { AdminTitle, Chip, EmptyState, Pager, adminPage } from "@/components/admin/admin-ui";
import { buttonClass, segmentItem, segmentTray } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field-class";

const STATUSES: Status[] = ["ACTIVE", "PENDING_VERIFICATION", "SUSPENDED", "DEACTIVATED"];

export async function generateMetadata(): Promise<Metadata> {
  const at = await getAdminDictionary(await getLocale());
  return { title: at.users.title, robots: { index: false } };
}

export default function UsersPage({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/users">) {
  return (
    <>
      <Suspense fallback={<DashboardSkeleton />}>
        <Users params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Users({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/users">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "admin", `/${locale}/dashboard/admin/users`);
  const sp = await searchParams;
  const role = (ROLES as string[]).includes(String(sp.role)) ? (sp.role as Role) : undefined;
  const status = (STATUSES as string[]).includes(String(sp.status)) ? (sp.status as Status) : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) || undefined : undefined;
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const [at, result] = await Promise.all([getAdminDictionary(locale), listUsers(user, { q, role, status, page })]);
  const u = at.users;
  const base = `/${locale}/dashboard/admin/users`;
  const href = (o: { role?: Role; page?: number }) => {
    const p = new URLSearchParams();
    if (o.role) p.set("role", o.role);
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    if (o.page && o.page > 1) p.set("page", String(o.page));
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <div className={adminPage}>
      <AdminTitle title={u.title} intro={u.intro} />

      <div className="-mx-5 mt-8 overflow-x-auto px-5 py-2 sm:mx-0 sm:px-0">
        <ul aria-label={u.rolesLabel} className={segmentTray}>
          {[undefined, ...ROLES].map((r) => (
            <li key={r ?? "all"}>
              <Link href={href({ role: r })} aria-current={r === role ? "page" : undefined} className={cn("block whitespace-nowrap", segmentItem(r === role))}>
                {r ? u.roleTabs[r] : u.allRoles}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <form method="get" role="search" className="mt-5 grid gap-3 sm:flex sm:flex-wrap sm:items-end">
        {role && <input type="hidden" name="role" value={role} />}
        <label className="grid min-w-0 flex-1 gap-1.5 text-sm font-medium sm:min-w-[16rem]">
          {u.search}
          <input type="search" name="q" defaultValue={q} className={cn(fieldClass, "border-ink/20 font-normal")} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {u.status}
          <select name="status" defaultValue={status ?? ""} className={cn(fieldClass, "border-ink/20 font-normal sm:w-56")}>
            <option value="">{u.allStatuses}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {at.userStatuses[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" className={buttonClass({ variant: "solid" })}>
            {u.submit}
          </button>
          {(q || status) && (
            <Link href={href({ role })} className="text-sm underline underline-offset-4 hover:text-rose-ink">
              {u.reset}
            </Link>
          )}
        </div>
      </form>

      <p className="mt-8 text-sm text-ink-2" aria-live="polite">
        {u.count(result.total)}
      </p>
      {result.rows.length === 0 ? (
        <EmptyState>{u.empty}</EmptyState>
      ) : (
        <ul className="card-soft mt-3 divide-y divide-line rounded-[28px] px-5 sm:px-7">
          {result.rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-medium">{r.fullName}</span>
                  {r.id === user.id && <span className="text-sm text-ink-2">({u.you})</span>}
                  <Chip tone={r.role === "CLIENT" || r.role === "PROVIDER" ? "quiet" : "ink"}>{at.roles[r.role]}</Chip>
                  {r.status !== "ACTIVE" && <Chip tone={r.status === "SUSPENDED" || r.status === "DEACTIVATED" ? "rose" : "quiet"}>{at.userStatuses[r.status]}</Chip>}
                </p>
                <p className="mt-1 truncate text-sm text-ink-2">
                  <bdi dir="ltr">{r.email}</bdi>
                </p>
                <p className="mt-1 text-sm text-ink-2">
                  {u.joined} {formatDate(r.createdAt, locale, { dateStyle: "medium" })} · {u.lastLogin} {r.lastLoginAt ? formatDate(r.lastLoginAt, locale, { dateStyle: "medium" }) : u.never}
                </p>
              </div>
              <Link href={`${base}/${r.id}`} className={buttonClass({ variant: "outline", size: "sm", className: "self-start sm:self-center" })}>
                {u.open}
                <span className="sr-only"> {r.fullName}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} pageCount={result.pageCount} href={(p) => href({ role, page: p })} copy={u} />
    </div>
  );
}
