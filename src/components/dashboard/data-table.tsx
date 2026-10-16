import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Dense, responsive table for admin lists: scrolls sideways inside its card on small screens. */
export function DataTable({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[42rem] text-sm">
        <thead>
          <tr className="border-b border-border text-start text-xs text-muted-foreground">
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-3 text-start font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
      {empty && <p className="p-6 text-sm text-muted-foreground">{empty}</p>}
    </div>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

/** Pill filters that live in the URL (shared, bookmarkable, server-filtered). */
export function FilterTabs({ items, active }: { items: { key: string; label: string; href: string }[]; active: string }) {
  return (
    <div className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={i.key === active ? "page" : undefined}
          className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors", i.key === active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/6 hover:text-foreground")}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export function Pager({ page, pageCount, href, labels }: { page: number; pageCount: number; href: (p: number) => string; labels: { previous: string; next: string } }) {
  if (pageCount <= 1) return null;
  return (
    <nav className="mt-5 flex items-center gap-4 text-sm">
      {page > 1 && (
        <Link href={href(page - 1)} className="text-muted-foreground hover:text-foreground">
          {labels.previous}
        </Link>
      )}
      <span className="tabular-nums text-muted-foreground" dir="ltr">
        {page} / {pageCount}
      </span>
      {page < pageCount && (
        <Link href={href(page + 1)} className="text-muted-foreground hover:text-foreground">
          {labels.next}
        </Link>
      )}
    </nav>
  );
}
