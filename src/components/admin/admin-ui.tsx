import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Shared pieces of the staff pages: title block, soft cards, status chips and the pager. */

export const adminPage = "mx-auto max-w-[1100px] px-5 pt-12 pb-24 sm:px-8 md:pt-16";

export function AdminTitle({ title, intro, back }: { title: string; intro?: string; back?: { href: string; label: string } }) {
  return (
    <header>
      {back && (
        <Link href={back.href} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-rose-ink">
          <ChevronLeft className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
          {back.label}
        </Link>
      )}
      <h1 className="type-display text-[clamp(2.6rem,5vw,4rem)] break-words">{title}</h1>
      {intro && <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-ink-2">{intro}</p>}
    </header>
  );
}

export function AdminCard({ title, children, className, aside }: { title?: string; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <section className={cn("card-soft rounded-[28px] p-6 sm:p-8", className)}>
      {(title || aside) && (
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          {title && <h2 className="type-display text-[clamp(1.7rem,2.6vw,2.2rem)]">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Chip({ children, tone = "quiet" }: { children: ReactNode; tone?: "quiet" | "rose" | "ink" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium",
        tone === "quiet" && "bg-ink/[0.06] text-ink-2",
        tone === "rose" && "bg-rose/12 text-rose-ink",
        tone === "ink" && "bg-ink text-ground",
      )}
    >
      {children}
    </span>
  );
}

export function ReadOnlyNote({ children }: { children: ReactNode }) {
  return <p className="mt-6 rounded-(--radius-field) bg-surface p-4 text-sm">{children}</p>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="mt-8 rounded-[28px] bg-parchment p-8 text-ink-2">{children}</p>;
}

export function Pager({ page, pageCount, href, copy }: { page: number; pageCount: number; href: (p: number) => string; copy: { previous: string; next: string; page: (p: number, n: number) => string } }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={copy.page(page, pageCount)} className="mt-8 flex flex-wrap items-center gap-3">
      {page > 1 && (
        <Link href={href(page - 1)} className={buttonClass({ variant: "outline", size: "sm" })}>
          {copy.previous}
        </Link>
      )}
      <span className="text-sm text-ink-2">{copy.page(page, pageCount)}</span>
      {page < pageCount && (
        <Link href={href(page + 1)} className={buttonClass({ variant: "outline", size: "sm" })}>
          {copy.next}
        </Link>
      )}
    </nav>
  );
}
