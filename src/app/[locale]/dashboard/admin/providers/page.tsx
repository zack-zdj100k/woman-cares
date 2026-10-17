import type { Metadata } from "next";
import Link from "next/link";
import { isLocale, type Locale } from "@/i18n/config";
import { getAdminDictionary, getAuthDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { listProviderQueue, queueTabCounts, type QueueFilter } from "@/server/services/review";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field-class";
import { cn } from "@/lib/cn";
import { pageClass } from "@/components/dashboard/shell/dashboard-shell";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

const FILTERS: QueueFilter[] = ["all", "pending", "approved", "suspended", "rejected"];

export async function generateMetadata(): Promise<Metadata> {
  const at = await getAdminDictionary(await getLocale());
  return { title: at.queue.title, robots: { index: false } };
}

export default function QueuePage({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/providers">) {
  return (
    <>
      <Queue params={params} searchParams={searchParams} />
    </>
  );
}

async function Queue({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/providers">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "admin", `/${locale}/dashboard/admin/providers`);
  const sp = await searchParams;
  const filter = (FILTERS as string[]).includes(String(sp.filter)) ? (sp.filter as QueueFilter) : "all";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) || undefined : undefined;
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));
  const [at, t, result, counts] = await Promise.all([getAdminDictionary(locale), getAuthDictionary(locale), listProviderQueue(user, filter, q, page), queueTabCounts(user)]);
  const href = (f: QueueFilter, p = 1) => `/${locale}/dashboard/admin/providers?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <div className={pageClass}>
      <h1 className="type-display text-[clamp(2.6rem,5vw,4rem)]">{at.queue.title}</h1>
      <div className="mt-8 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link key={f} href={href(f)} aria-current={f === filter ? "page" : undefined} className={cn("rounded-full px-4 py-2 text-sm", f === filter ? "bg-ink text-ground" : "border border-line text-ink-2 hover:text-ink")}>
            {at.queue.filters[f]} <span className="tabular-nums opacity-70">{counts[f]}</span>
          </Link>
        ))}
      </div>
      <form method="get" role="search" className="mt-5 flex w-full max-w-xl gap-2">
        <input type="hidden" name="filter" value={filter} />
        <input name="q" defaultValue={q} aria-label={at.queue.search} placeholder={at.queue.search} className={cn(fieldClass, "min-w-0 flex-1 border-ink/25")} />
        <button type="submit" className={buttonClass({ variant: "outline" })}>
          {at.queue.searchSubmit}
        </button>
      </form>
      {result.rows.length === 0 ? (
        <p className="mt-10 rounded-(--radius-field) bg-surface p-6 text-ink-2">{at.queue.empty}</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {result.rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-medium">
                  {r.businessName} {r.verifiedAt && <span className="ms-2 text-sm text-rose-ink">{at.queue.verified}</span>}
                </p>
                <p className="text-sm text-ink-2">
                  <bdi dir="ltr">{r.user.email}</bdi>
                  {!r.user.emailVerifiedAt && ` · ${at.queue.emailUnverified}`} · {locale === "ar" ? r.wilaya.nameAr : r.wilaya.nameFr} · {t.dashboard.provider.statuses[r.status]}
                  {r.user.status === "SUSPENDED" && <span className="ms-2 rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">{at.queue.userSuspended}</span>}
                </p>
                <p className="text-sm">{at.queue.pendingItems(r._count.profiles, r._count.categoryRequests, r._count.credentials)}</p>
              </div>
              <Link href={`/${locale}/dashboard/admin/providers/${r.id}`} className={buttonClass({ variant: "solid", size: "sm", className: "self-start" })}>
                {at.queue.open}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {result.pageCount > 1 && (
        <nav className="mt-8 flex gap-3">
          {page > 1 && <Link href={href(filter, page - 1)} className="underline">{at.queue.previous}</Link>}
          {page < result.pageCount && <Link href={href(filter, page + 1)} className="underline">{at.queue.next}</Link>}
        </nav>
      )}
    </div>
  );
}
