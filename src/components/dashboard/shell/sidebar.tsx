"use client";

/*
 * Dashboard shell (owner's "app-1" reference, in black): a sidebar that collapses to icons on desktop,
 * opens as a drawer on phones and mirrors in Arabic; an inset column for the page.
 * API follows shadcn's SidebarProvider / Sidebar / SidebarInset / SidebarTrigger.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { icons, type IconName } from "./icons";
export { icons, type IconName };

export type NavItem = { href: string; label: string; icon: IconName; badge?: number; exact?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

type Ctx = { collapsed: boolean; toggle: () => void; mobileOpen: boolean; setMobileOpen: (v: boolean) => void };
const SidebarContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "wc:sidebar-collapsed";

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      // Restoring a per-viewer preference from browser storage after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setMobileOpen((o) => !o);
      return;
    }
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, mobileOpen, setMobileOpen }}>
      <TooltipProvider delayDuration={150}>
        <div className="dashboard-dark flex min-h-dvh w-full">{children}</div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

/** Shown only while a click on this link is still loading (and only after 120 ms, so fast navigations never flicker). */
function PendingHint() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className={cn("pointer-events-none absolute inset-x-2.5 bottom-1 h-0.5 rounded-full bg-chart-1 opacity-0 transition-opacity", pending && "animate-pulse opacity-100 delay-[120ms]")} />;
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavList({ groups, collapsed, label, onNavigate }: { groups: NavGroup[]; collapsed: boolean; label: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex-1 overflow-y-auto px-3 py-2 [scrollbar-width:thin]">
      {groups.map((group) => (
        <div key={group.label} className="mb-5">
          <p className={cn("mb-1.5 px-2 text-[0.7rem] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/45", collapsed && "sr-only")}>{group.label}</p>
          <ul className="grid gap-0.5">
            {group.items.map((item) => {
              const Icon = icons[item.icon];
              const active = isActive(pathname, item);
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group/item relative flex h-10 items-center gap-3 rounded-xl px-2.5 text-[0.92rem] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-white",
                    active && "bg-sidebar-accent text-white before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-chart-1",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Icon className="size-[1.15rem] shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
                  <PendingHint />
                  {item.badge ? (
                    <span
                      className={cn(
                        "ms-auto grid min-w-5 place-items-center rounded-full bg-chart-1 px-1.5 text-[0.7rem] font-semibold text-[#1a0e13] tabular-nums",
                        collapsed && "absolute end-1 top-1 ms-0 min-w-4 px-1 text-[0.6rem]",
                      )}
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  ) : null}
                </Link>
              );
              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ href, area, collapsed }: { href: string; area: string; collapsed: boolean }) {
  return (
    <Link href={href} className={cn("flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4", collapsed && "justify-center px-0")}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(180deg,#f6dfe6,#e3b8c5)] text-[0.8rem] font-semibold text-[#1a0e13]" dir="ltr">
        WC
      </span>
      <span className={cn("min-w-0 leading-tight", collapsed && "sr-only")}>
        <span className="block text-sm font-semibold tracking-[0.18em] text-white" dir="ltr">
          WOMAN CARES
        </span>
        <span className="block truncate text-xs text-sidebar-foreground/60">{area}</span>
      </span>
    </Link>
  );
}

export function DashboardSidebar({ groups, home, area, footer, closeLabel }: { groups: NavGroup[]; home: string; area: string; footer?: ReactNode; closeLabel: string }) {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar();
  return (
    <>
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-sidebar-border bg-sidebar transition-[width] duration-300 ease-(--ease-soft) md:flex",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        <Brand href={home} area={area} collapsed={collapsed} />
        <NavList groups={groups} collapsed={collapsed} label={area} />
        {footer && <div className={cn("border-t border-sidebar-border p-3", collapsed && "hidden")}>{footer}</div>}
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="start" closeLabel={closeLabel} aria-describedby={undefined}>
          <SheetTitle className="sr-only">{area}</SheetTitle>
          <Brand href={home} area={area} collapsed={false} />
          <NavList groups={groups} collapsed={false} label={area} onNavigate={() => setMobileOpen(false)} />
          {footer && <div className="border-t border-sidebar-border p-3">{footer}</div>}
        </SheetContent>
      </Sheet>
    </>
  );
}

export function SidebarTrigger({ label }: { label: string }) {
  const { toggle } = useSidebar();
  return (
    <button type="button" onClick={toggle} aria-label={label} className="grid size-9 place-items-center rounded-xl text-foreground/75 transition-colors hover:bg-white/8 hover:text-foreground">
      <PanelLeft className="size-[1.15rem] rtl:-scale-x-100" strokeWidth={1.75} />
    </button>
  );
}

export function SidebarInset({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-h-dvh min-w-0 flex-1 flex-col", className)}>{children}</div>;
}
