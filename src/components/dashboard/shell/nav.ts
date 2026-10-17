import type { Locale } from "@/i18n/config";
import type { DashboardDictionary } from "@/i18n/dictionaries/dashboard.fr";
import type { IconName } from "./icons";
import type { NavGroup } from "./sidebar";

/**
 * Sidebar modules per dashboard. A module appears only once its pages work ("only expose routes when
 * their functionality exists"): flip `ready` when a module ships. Role limits come from `allowed`.
 */
type Module = { key: string; path: string; icon: IconName; label: (n: DashboardDictionary["nav"]) => string; ready: boolean; exact?: boolean; badge?: string };
type Group = { label: (g: DashboardDictionary["nav"]["groups"]) => string; modules: Module[] };

const client: Group[] = [
  {
    label: (g) => g.main,
    modules: [
      { key: "overview", path: "", icon: "overview", label: (n) => n.overview, ready: true, exact: true },
      { key: "appointments", path: "/appointments", icon: "appointments", label: (n) => n.appointments, ready: true, badge: "action" },
      { key: "favorites", path: "/favorites", icon: "favorites", label: (n) => n.favorites, ready: false },
      { key: "reviews", path: "/reviews", icon: "reviews", label: (n) => n.reviews, ready: false },
    ],
  },
  {
    label: (g) => g.account,
    modules: [
      { key: "notifications", path: "/notifications", icon: "notifications", label: (n) => n.notifications, ready: true, badge: "unread" },
      { key: "profile", path: "/profile", icon: "profile", label: (n) => n.profile, ready: true },
      { key: "support", path: "/support", icon: "support", label: (n) => n.support, ready: false },
    ],
  },
];

const provider: Group[] = [
  {
    label: (g) => g.main,
    modules: [
      { key: "overview", path: "", icon: "overview", label: (n) => n.overview, ready: true, exact: true },
      { key: "bookings", path: "/bookings", icon: "bookings", label: (n) => n.bookings, ready: true, badge: "pending" },
      { key: "calendar", path: "/calendar", icon: "calendar", label: (n) => n.calendar, ready: true },
    ],
  },
  {
    label: (g) => g.business,
    modules: [
      { key: "profiles", path: "/profiles", icon: "profiles", label: (n) => n.profiles, ready: true },
      { key: "services", path: "/services", icon: "services", label: (n) => n.services, ready: true },
      { key: "schedule", path: "/schedule", icon: "schedule", label: (n) => n.schedule, ready: true },
    ],
  },
  {
    label: (g) => g.money,
    modules: [
      { key: "earnings", path: "/earnings", icon: "earnings", label: (n) => n.earnings, ready: true },
      { key: "analytics", path: "/analytics", icon: "analytics", label: (n) => n.analytics, ready: true },
      { key: "subscription", path: "/subscriptions", icon: "subscription", label: (n) => n.subscription, ready: true },
      { key: "invoices", path: "/invoices", icon: "invoices", label: (n) => n.invoices, ready: true },
    ],
  },
  {
    label: (g) => g.account,
    modules: [
      { key: "notifications", path: "/notifications", icon: "notifications", label: (n) => n.notifications, ready: true, badge: "unread" },
      { key: "settings", path: "/settings", icon: "settings", label: (n) => n.settings, ready: true },
      { key: "support", path: "/support", icon: "support", label: (n) => n.support, ready: false },
    ],
  },
];

const admin: Group[] = [
  {
    label: (g) => g.platform,
    modules: [
      { key: "overview", path: "", icon: "overview", label: (n) => n.overview, ready: true, exact: true },
      { key: "providers", path: "/providers", icon: "providers", label: (n) => n.providers, ready: true, badge: "review" },
      { key: "users", path: "/users", icon: "users", label: (n) => n.users, ready: true },
      { key: "bookings", path: "/bookings", icon: "bookings", label: (n) => n.adminBookings, ready: false },
    ],
  },
  {
    label: (g) => g.catalogue,
    modules: [
      { key: "categories", path: "/categories", icon: "categories", label: (n) => n.categories, ready: true },
      { key: "pricing", path: "/pricing", icon: "pricing", label: (n) => n.pricing, ready: true },
    ],
  },
  {
    label: (g) => g.billing,
    modules: [
      { key: "subscriptions", path: "/subscriptions", icon: "subscription", label: (n) => n.subscriptions, ready: true },
      { key: "invoices", path: "/invoices", icon: "invoices", label: (n) => n.adminInvoices, ready: true },
      { key: "payments", path: "/payments", icon: "payments", label: (n) => n.payments, ready: true, badge: "payments" },
    ],
  },
  {
    label: (g) => g.content,
    modules: [
      { key: "content", path: "/content", icon: "content", label: (n) => n.content, ready: false },
      { key: "moderation", path: "/moderation", icon: "moderation", label: (n) => n.moderation, ready: false },
      { key: "messages", path: "/messages", icon: "support", label: (n) => n.messages, ready: true, badge: "messages" },
    ],
  },
  {
    label: (g) => g.system,
    modules: [
      { key: "analytics", path: "/analytics", icon: "analytics", label: (n) => n.adminAnalytics, ready: false },
      { key: "notifications", path: "/notifications", icon: "notifications", label: (n) => n.notifications, ready: true, badge: "unread" },
      { key: "audit", path: "/audit-logs", icon: "audit", label: (n) => n.audit, ready: true },
      { key: "settings", path: "/settings", icon: "settings", label: (n) => n.platformSettings, ready: false },
    ],
  },
];

const byArea = { client, provider, admin };

export function buildNav(
  area: keyof typeof byArea,
  locale: Locale,
  d: DashboardDictionary,
  opts: { badges?: Record<string, number>; allowed?: (key: string) => boolean } = {},
): NavGroup[] {
  const base = `/${locale}/dashboard/${area}`;
  return byArea[area]
    .map((g) => ({
      label: g.label(d.nav.groups),
      items: g.modules
        .filter((m) => m.ready && (opts.allowed?.(m.key) ?? true))
        .map((m) => ({ href: `${base}${m.path}`, label: m.label(d.nav), icon: m.icon, exact: m.exact, badge: m.badge ? opts.badges?.[m.badge] : undefined })),
    }))
    .filter((g) => g.items.length > 0);
}
