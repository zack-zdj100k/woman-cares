import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDashboardDictionary } from "@/i18n/get-dictionary";
import type { SessionUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { listMyNotifications, notificationHref } from "@/server/services/notifications";
import { markReadAction } from "@/app/[locale]/dashboard/notification-actions";
import { PageHeader, pageClass } from "@/components/dashboard/shell/dashboard-shell";
import { Pager } from "@/components/dashboard/data-table";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Notification centre shared by the client and professional dashboards. */
export async function NotificationsView({ user, locale, area, page }: { user: SessionUser; locale: Locale; area: "client" | "provider"; page: number }) {
  const [d, data] = await Promise.all([getDashboardDictionary(locale), listMyNotifications(user, page)]);
  const n = d.notifications;
  return (
    <div className={pageClass}>
      <PageHeader
        title={n.title}
        description={n.description}
        actions={
          data.unread > 0 ? (
            <form action={markReadAction}>
              <input type="hidden" name="id" value="all" />
              <button type="submit" className={buttonClass({ variant: "outline", size: "sm" })}>
                {n.markAll}
              </button>
            </form>
          ) : undefined
        }
      />
      {data.rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">{n.empty}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {data.rows.map((row) => (
            <li key={row.id} className={cn("flex flex-wrap items-start gap-3 p-4 sm:flex-nowrap", !row.readAt && "bg-white/[0.025]")}>
              <span aria-hidden="true" className={cn("mt-1.5 size-2 shrink-0 rounded-full", row.readAt ? "bg-transparent" : "bg-chart-1")} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {row.title}
                  {!row.readAt && <span className="sr-only"> ({n.unread})</span>}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{row.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(row.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link href={notificationHref(locale, area, row.type)} className="rounded-lg px-2.5 py-1.5 text-sm text-chart-1 hover:bg-white/6">
                  {n.open}
                </Link>
                {!row.readAt && (
                  <form action={markReadAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button type="submit" className="rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-white/6 hover:text-foreground">
                      {n.markRead}
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} pageCount={data.pageCount} href={(p) => `/${locale}/dashboard/${area}/notifications?page=${p}`} labels={{ previous: "‹", next: "›" }} />
    </div>
  );
}
