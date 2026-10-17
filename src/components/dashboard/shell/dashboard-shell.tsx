import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Bell, ExternalLink } from "lucide-react";
import { categorySlugs, type CategorySlug } from "@/config/categories";
import { localeLabel, locales, type Locale } from "@/i18n/config";
import { getAuthDictionary, getDashboardDictionary, getDictionary } from "@/i18n/get-dictionary";
import type { SessionUser } from "@/lib/auth/session";
import { homeArea, type Area } from "@/server/policies/roles";
import { FindCareProvider } from "@/components/marketing/find-care";
import { AccountMenu } from "@/components/layout/account-menu";
import { LocaleSwitch } from "@/components/layout/locale-switch";
import { DashboardSidebar, SidebarInset, SidebarProvider, SidebarTrigger, type NavGroup } from "./sidebar";

/**
 * The dashboards' application shell (all three areas): black workspace, sidebar with only the
 * modules that exist for this role, top bar with notifications, language and account.
 */
export async function DashboardShell({
  locale,
  area,
  user,
  groups,
  unread,
  notificationsHref,
  children,
}: {
  locale: Locale;
  area: Area;
  user: SessionUser;
  groups: NavGroup[];
  unread: number;
  notificationsHref: string;
  children: ReactNode;
}) {
  const [d, t, site] = await Promise.all([getDashboardDictionary(locale), getAuthDictionary(locale), getDictionary(locale)]);
  const other = locales.find((l) => l !== locale)!;
  const home = `/${locale}/dashboard/${homeArea(user.role)}`;
  const initials = user.fullName
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  const categoryNames = Object.fromEntries(categorySlugs.map((s) => [s, site.categories[s].name])) as Record<CategorySlug, string>;

  const footer = (
    <div className="flex items-center gap-3 rounded-xl px-1.5 py-1">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-accent text-xs font-semibold text-white" aria-hidden="true">
        {initials}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm text-white">{user.fullName}</span>
        <span className="block truncate text-xs text-sidebar-foreground/60">{d.shell.roles[user.role]}</span>
      </span>
    </div>
  );

  return (
    <FindCareProvider locale={locale} copy={site.search} categoryNames={categoryNames}>
      <SidebarProvider>
        <Suspense fallback={<div className="hidden w-64 shrink-0 border-e border-sidebar-border bg-sidebar md:block" />}>
          <DashboardSidebar groups={groups} home={`/${locale}/dashboard/${area}`} area={d.shell.areas[area]} footer={footer} closeLabel={d.shell.close} />
        </Suspense>
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-5">
            <Suspense fallback={<span className="size-9" />}>
              <SidebarTrigger label={d.shell.toggle} />
            </Suspense>
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
            <p className="truncate text-sm text-muted-foreground">{d.shell.areas[area]}</p>
            <div className="ms-auto flex items-center gap-1">
              <Link href={`/${locale}`} className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-foreground/75 hover:bg-white/8 hover:text-foreground lg:inline-flex">
                {d.shell.website}
                <ExternalLink className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
              </Link>
              <LocaleSwitch target={other} className="rounded-xl px-3 py-2 text-sm text-foreground/75 hover:bg-white/8 hover:text-foreground" aria-label={localeLabel[other]} />
              <Link
                href={notificationsHref}
                aria-label={unread ? `${d.shell.notifications}, ${d.shell.unread(unread)}` : d.shell.notifications}
                className="relative grid size-9 place-items-center rounded-xl text-foreground/75 hover:bg-white/8 hover:text-foreground"
              >
                <Bell className="size-[1.15rem]" strokeWidth={1.75} />
                {unread > 0 && (
                  <span className="absolute end-1 top-1 grid min-w-4 place-items-center rounded-full bg-chart-1 px-1 text-[0.6rem] font-semibold text-[#1a0e13] tabular-nums">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <AccountMenu
                locale={locale}
                firstName={initials}
                dashboardHref={home}
                settings={{ href: `${home}/${area === "client" ? "profile" : "account"}`, label: d.account.menu }}
                labels={t.account}
                pillClass="grid size-9 place-items-center rounded-full bg-secondary text-xs font-semibold text-foreground hover:bg-accent [&>svg]:hidden"
              />
            </div>
          </header>
          <main id="main" className="flex-1">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </FindCareProvider>
  );
}

/** Page title block used by every dashboard module. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-[48rem] text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** The content column of a dashboard page. */
export const pageClass = "mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8";
