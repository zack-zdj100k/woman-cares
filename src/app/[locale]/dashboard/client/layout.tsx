import { Suspense } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDashboardDictionary } from "@/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { canAccessArea } from "@/server/policies/roles";
import { shellCounts } from "@/server/services/dashboard-shell";
import { DashboardShell } from "@/components/dashboard/shell/dashboard-shell";
import { buildNav } from "@/components/dashboard/shell/nav";

/** Every client dashboard page sits in the shared dark shell. Pages still check access themselves. */
export default function Layout({ children, params }: LayoutProps<"/[locale]/dashboard/client">) {
  return (
    <Suspense fallback={<div className="dashboard-dark min-h-dvh" />}>
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children, params }: { children: React.ReactNode; params: LayoutProps<"/[locale]/dashboard/client">["params"] }) {
  const { locale: l } = await params;
  const locale: Locale = isLocale(l) ? l : "fr";
  const user = await getSessionUser();
  // Not allowed here: render the page alone, which redirects to sign-in or shows the 404 page.
  if (!user || !canAccessArea(user, "client")) return <div className="dashboard-dark min-h-dvh">{children}</div>;
  const [d, counts] = await Promise.all([getDashboardDictionary(locale), shellCounts(user, "client")]);
  const groups = buildNav("client", locale, d, { badges: counts.badges });
  const notificationsHref = `/${locale}/dashboard/client/notifications`;
  return (
    <DashboardShell locale={locale} area="client" user={user} groups={groups} unread={counts.unread} notificationsHref={notificationsHref}>
      {children}
    </DashboardShell>
  );
}
