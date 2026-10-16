import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin, Star, Video } from "lucide-react";
import { ArrowDot, buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type SoftCardProps = {
  href: string;
  name: string;
  verified: boolean;
  verifiedLabel: string;
  place: string;
  meta?: string;
  headline?: string | null;
  priceLabel?: string | null;
  imageUrl?: string | null;
  tags?: string[];
  rating?: { value: number; label: string } | null;
  hasVideo?: boolean;
  videoLabel?: string;
  bookLabel: string;
  /** Picture on top instead of below (alternate in grids for rhythm, as in the reference). */
  imageFirst?: boolean;
  priority?: boolean;
  sizes?: string;
};

/**
 * Soft card (owner's picture 4): white rounded card, title with a pill badge, a short meta line,
 * the price beside a glossy "book" pill with its arrow dot, and the picture with glass tags.
 * Ratings show only when real reviews exist.
 */
export function SoftCard(p: SoftCardProps) {
  const text = (
    <div className="px-3 pt-3 pb-1">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[1.3rem] font-medium leading-snug tracking-[-0.01em]">
          <Link href={p.href} className="after:absolute after:inset-0 after:rounded-[30px] focus-visible:outline-none">
            {p.name}
          </Link>
        </h3>
        {p.verified && (
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-white/70 px-2.5 py-1 text-xs">
            <BadgeCheck className="size-3.5 text-rose" strokeWidth={1.75} aria-hidden="true" />
            {p.verifiedLabel}
          </span>
        )}
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
        <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span className="min-w-0 truncate">
          {p.place}
          {p.meta && <span aria-hidden="true"> • </span>}
          {p.meta}
        </span>
      </p>
      {p.headline && <p className="mt-2 line-clamp-2 text-[0.92rem] leading-relaxed text-ink-2">{p.headline}</p>}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[1.05rem] font-medium">{p.priceLabel}</p>
        <Link href={`${p.href}#reserver`} className={buttonClass({ variant: "solid", size: "sm", className: "relative z-10 ps-4 pe-3" })}>
          {p.bookLabel}
          <ArrowDot />
        </Link>
      </div>
    </div>
  );

  const picture = (
    <div className="relative aspect-[5/4] overflow-hidden rounded-[24px] bg-surface-2">
      {p.imageUrl && (
        <Image
          src={p.imageUrl}
          alt=""
          fill
          priority={p.priority}
          sizes={p.sizes ?? "(min-width: 1280px) 24rem, (min-width: 768px) 45vw, 92vw"}
          className="object-cover transition-transform duration-[1.2s] ease-(--ease-soft) group-hover:scale-[1.05]"
        />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-[rgb(var(--scrim)/0.35)] to-transparent" />
      {p.hasVideo && (
        <span className="absolute end-3 top-3 grid size-9 place-items-center rounded-full border border-white/40 bg-[rgb(22_10_16/0.35)] text-white">
          <Video className="size-4" strokeWidth={1.75} />
          <span className="sr-only">{p.videoLabel}</span>
        </span>
      )}
      <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
        <ul className="flex min-w-0 flex-wrap gap-1.5">
          {(p.tags ?? []).slice(0, 2).map((t) => (
            <li key={t} className="truncate rounded-full border border-white/40 bg-[rgb(22_10_16/0.35)] px-3 py-1 text-xs text-white">
              {t}
            </li>
          ))}
        </ul>
        {p.rating && (
          <p className="flex shrink-0 items-center gap-1 text-sm text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.4)]" aria-label={p.rating.label}>
            <Star className="size-3.5 fill-current" strokeWidth={1.5} aria-hidden="true" />
            {p.rating.value.toFixed(1)}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <article className={cn("card-soft group relative flex h-full w-full min-w-0 flex-col gap-3 rounded-[30px] p-2.5 transition-[transform,box-shadow] duration-500 ease-(--ease-soft) hover:-translate-y-1 hover:shadow-(--shadow-float)")}>
      {p.imageFirst ? (
        <>
          {picture}
          {text}
        </>
      ) : (
        <>
          {text}
          <div className="mt-auto">{picture}</div>
        </>
      )}
    </article>
  );
}
