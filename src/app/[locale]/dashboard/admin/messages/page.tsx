import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Mail } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getAdminDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { canReadMessages } from "@/server/policies/roles";
import { listMessages, type MessageFilter } from "@/server/services/messages";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { FilterTabs, Pager } from "@/components/dashboard/data-table";
import { ManageForm } from "@/components/admin/manage-form";
import { DecisionFeedback } from "@/components/ui/decision-feedback";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";

/** Waits for its data on navigation (see the dashboard layout). */
export const instant = false;

const FILTERS: MessageFilter[] = ["new", "progress", "done", "all"];

export async function generateMetadata(): Promise<Metadata> {
  const at = await getAdminDictionary(await getLocale());
  return { title: at.messages.title, robots: { index: false } };
}

export default function Page({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/messages">) {
  return <Messages params={params} searchParams={searchParams} />;
}

async function Messages({ params, searchParams }: PageProps<"/[locale]/dashboard/admin/messages">) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await requireArea(locale, "admin", `/${locale}/dashboard/admin/messages`);
  if (!canReadMessages(user)) notFound();
  const sp = await searchParams;
  const filter = FILTERS.includes(sp.filter as MessageFilter) ? (sp.filter as MessageFilter) : "new";
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));
  const open = typeof sp.open === "string" ? sp.open : null;
  const [at, data] = await Promise.all([getAdminDictionary(locale), listMessages(user, open ? "all" : filter, page)]);
  const m = at.messages;
  const labels = { done: at.manage.done, errors: at.manage.errors };
  const base = `/${locale}/dashboard/admin/messages`;
  const href = (f: string, p = 1) => `${base}?filter=${f}${p > 1 ? `&page=${p}` : ""}`;
  const rows = open ? data.rows.filter((r) => r.id === open).concat(data.rows.filter((r) => r.id !== open)) : data.rows;

  return (
    <div className={pageClass}>
      <PageHeader title={m.title} description={m.intro} />
      <FilterTabs active={open ? "" : filter} items={FILTERS.map((f) => ({ key: f, label: `${m.filters[f]} · ${data.counts[f]}`, href: href(f) }))} />
      <DecisionFeedback>
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">{m.empty}</p>
        ) : (
          <ul className="grid gap-4">
            {rows.map((r) => (
              <li key={r.id} id={r.id} className={cn("rounded-2xl border bg-card p-5", r.id === open ? "border-chart-1/60" : "border-border")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {r.subject}
                      <Badge variant={r.status === "OPEN" ? "rose" : r.status === "IN_PROGRESS" ? "warning" : "outline"}>{m.statuses[r.status]}</Badge>
                      <Badge variant="secondary">{m.types[r.type] ?? r.type}</Badge>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {m.from} {r.name ?? "-"} · <bdi dir="ltr">{r.email ?? "-"}</bdi> · {formatDate(r.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  {r.email && (
                    <a href={`mailto:${r.email}?subject=${encodeURIComponent(`Re: ${r.subject}`)}`} className={buttonClass({ variant: "outline", size: "sm" })}>
                      <Mail className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      {m.reply}
                    </a>
                  )}
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{r.message}</p>
                <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-border pt-4">
                  {r.status !== "IN_PROGRESS" && r.status === "OPEN" && (
                    <ManageForm op="message.status" id={r.id} label={m.inProgress} labels={labels} fields={<input type="hidden" name="status" value="IN_PROGRESS" />} />
                  )}
                  {(r.status === "OPEN" || r.status === "IN_PROGRESS") && (
                    <ManageForm op="message.status" id={r.id} label={m.resolve} labels={labels} tone="solid" fields={<input type="hidden" name="status" value="RESOLVED" />} />
                  )}
                  {(r.status === "RESOLVED" || r.status === "CLOSED") && (
                    <ManageForm op="message.status" id={r.id} label={m.reopen} labels={labels} fields={<input type="hidden" name="status" value="OPEN" />} />
                  )}
                  <ManageForm op="message.delete" id={r.id} label={m.delete} labels={labels} tone="danger" confirm={m.deleteConfirm} className="ms-auto" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </DecisionFeedback>
      <Pager page={page} pageCount={data.pageCount} href={(p) => href(filter, p)} labels={{ previous: "‹", next: "›" }} />
    </div>
  );
}
