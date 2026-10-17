import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getAdminDictionary, getDictionary } from "@/i18n/get-dictionary";
import { isCategorySlug } from "@/config/categories";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { isIsoDay } from "@/lib/pricing-dates";
import { cn } from "@/lib/cn";
import { canDelete, canViewAudit } from "@/server/policies/roles";
import { ForbiddenError } from "@/server/services/admin-users";
import { SYSTEM_ACTOR, auditFilterOptions, listAuditLog, type AuditFilters } from "@/server/services/audit";
import { AdminTitle, Chip, EmptyState, Pager, adminPage } from "@/components/admin/admin-ui";
import { buttonClass } from "@/components/ui/button";
import { ManageForm } from "@/components/admin/manage-form";
import { fieldClass } from "@/components/ui/field-class";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const at = await getAdminDictionary(await getLocale());
  return { title: at.auditLog.title, robots: { index: false } };
}

export default function AuditPage({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/audit-logs">) {
  return (
    <>
      <Audit params={params} searchParams={searchParams} />
    </>
  );
}

const str = (v: string | string[] | undefined, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || undefined : undefined);

/** Short, readable summary of an entry's metadata (category, roles, prices, notes) in the page's language. */
function summary(meta: unknown, at: Awaited<ReturnType<typeof getAdminDictionary>>, category: (slug: string) => string) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return [];
  const value = (k: string, v: unknown) => {
    const s = String(v);
    if (k === "category") return category(s);
    if (k === "from" || k === "to") return at.roles[s] ?? at.userStatuses[s] ?? s;
    return s;
  };
  return Object.entries(meta as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== "" && typeof v !== "object")
    .map(([k, v]) => at.auditLog.pair(at.auditLog.keys[k] ?? k, value(k, v)))
    .map((s) => (s.length > 160 ? `${s.slice(0, 157)}...` : s));
}

async function Audit({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/audit-logs">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "admin", `/${locale}/dashboard/admin/audit-logs`);
  if (!canViewAudit(user)) notFound();
  const remove = canDelete(user);
  const sp = await searchParams;
  const from = str(sp.from, 10);
  const to = str(sp.to, 10);
  const filters: AuditFilters = {
    action: str(sp.action, 80),
    actor: str(sp.actor, 40),
    entityType: str(sp.entity, 60),
    from: from && isIsoDay(from) ? from : undefined,
    to: to && isIsoDay(to) ? to : undefined,
    page: Math.max(1, Math.min(2000, Number(sp.page) || 1)),
  };
  let result: Awaited<ReturnType<typeof listAuditLog>>;
  let options: Awaited<ReturnType<typeof auditFilterOptions>>;
  try {
    [result, options] = await Promise.all([listAuditLog(user, filters), auditFilterOptions(user)]);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }
  const [at, dict] = await Promise.all([getAdminDictionary(locale), getDictionary(locale)]);
  const a = at.auditLog;
  const categoryName = (slug: string) => (isCategorySlug(slug) ? dict.categories[slug].name : slug);
  const base = `/${locale}/dashboard/admin/audit-logs`;
  const href = (page: number) => {
    const p = new URLSearchParams();
    if (filters.action) p.set("action", filters.action);
    if (filters.actor) p.set("actor", filters.actor);
    if (filters.entityType) p.set("entity", filters.entityType);
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const filtered = Boolean(filters.action || filters.actor || filters.entityType || filters.from || filters.to);
  const field = cn(fieldClass, "border-ink/20 font-normal");
  const entityHref = (type: string, id: string) =>
    type === "User" ? `/${locale}/dashboard/admin/users/${id}` : type === "ProviderAccount" ? `/${locale}/dashboard/admin/providers/${id}` : null;

  return (
    <div className={adminPage}>
      <AdminTitle title={a.title} intro={a.intro} />

      <form method="get" className="card-soft mt-8 grid gap-4 rounded-[28px] p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-3">
        <label className="grid gap-1.5 text-sm font-medium">
          {a.action}
          <select name="action" defaultValue={filters.action ?? ""} className={field}>
            <option value="">{a.allActions}</option>
            {options.actions.map((x) => (
              <option key={x} value={x}>
                {at.audit[x] ?? x}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {a.actor}
          <select name="actor" defaultValue={filters.actor ?? ""} className={field}>
            <option value="">{a.all}</option>
            {options.hasSystem && <option value={SYSTEM_ACTOR}>{a.system}</option>}
            {options.actors.map((x) => (
              <option key={x.id} value={x.id}>
                {x.fullName} ({at.roles[x.role]})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {a.entity}
          <select name="entity" defaultValue={filters.entityType ?? ""} className={field}>
            <option value="">{a.all}</option>
            {options.entityTypes.map((x) => (
              <option key={x} value={x}>
                {a.entityTypes[x] ?? x}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {a.from}
          <input type="date" name="from" defaultValue={filters.from} className={field} dir="ltr" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {a.to}
          <input type="date" name="to" defaultValue={filters.to} className={field} dir="ltr" />
        </label>
        <div className="flex items-end gap-3">
          <button type="submit" className={buttonClass({ variant: "solid" })}>
            {a.submit}
          </button>
          {filtered && (
            <Link href={base} className="pb-3 text-sm underline underline-offset-4 hover:text-rose-ink">
              {a.reset}
            </Link>
          )}
        </div>
      </form>

      <p className="mt-8 text-sm text-ink-2">{a.count(result.total)}</p>
      {result.rows.length === 0 ? (
        <EmptyState>{a.empty}</EmptyState>
      ) : (
        <ol className="card-soft mt-3 divide-y divide-line rounded-[28px] px-5 sm:px-7">
          {result.rows.map((r) => {
            const link = entityHref(r.entityType, r.entityId);
            const details = summary(r.metadata, at, categoryName);
            return (
              <li key={r.id} className="grid gap-1 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
                <p className="text-sm text-ink-2 tabular-nums">{formatDate(r.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</p>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{at.audit[r.action] ?? r.action}</span>
                    <Chip>{a.entityTypes[r.entityType] ?? r.entityType}</Chip>
                  </p>
                  <p className="mt-0.5 text-sm text-ink-2">
                    {a.by} {r.actor ? `${r.actor.fullName} (${at.roles[r.actor.role]})` : a.system}
                    {" · "}
                    {link ? (
                      <Link href={link} className="underline underline-offset-4 hover:text-rose-ink">
                        <bdi dir="ltr">{r.entityId.slice(0, 8)}</bdi>
                      </Link>
                    ) : (
                      <bdi dir="ltr">{r.entityId.slice(0, 8)}</bdi>
                    )}
                  </p>
                  {details.length > 0 && (
                    <p className="mt-1 text-sm break-words text-ink-2">
                      <span className="sr-only">{a.details} : </span>
                      <bdi>{details.join(" · ")}</bdi>
                    </p>
                  )}
                  {remove && (
                    <ManageForm op="audit.delete" id={r.id} label={at.deletes.entry} labels={{ done: at.manage.done, errors: at.manage.errors }} tone="danger" confirm={at.deletes.entryConfirm} className="mt-2" />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <Pager page={filters.page} pageCount={result.pageCount} href={href} copy={a} />
    </div>
  );
}
