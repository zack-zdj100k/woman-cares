import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shape rule (docs/DESIGN.md): every interactive control is a full pill;
 * media and cards use --radius-media; fields use --radius-field.
 */
const base =
  "group/btn relative inline-flex max-w-full items-center justify-center gap-2 rounded-full text-center leading-tight font-medium [&>svg]:shrink-0 " +
  "transition-[background-color,color,border-color,transform,box-shadow] duration-300 ease-(--ease-soft) " +
  "hover:-translate-y-px active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

/*
 * Soft, tactile controls (owner's picture 8): a glossy near-black pill with an inner highlight and a
 * soft drop shadow for the main action; a white pill on a soft shadow for everything else.
 */
const variants = {
  /** Main action: glossy plum-black. */
  solid:
    "btn-solid bg-[linear-gradient(180deg,#4a3540_0%,#2a1a21_55%,#1d1116_100%)] text-[#fff8f6] " +
    "shadow-[inset_0_1px_0_rgb(255_255_255/0.22),inset_0_-2px_6px_rgb(0_0_0/0.35),0_12px_24px_-10px_rgb(29_17_22/0.65)] " +
    "hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.26),inset_0_-2px_6px_rgb(0_0_0/0.35),0_16px_30px_-10px_rgb(29_17_22/0.7)]",
  /** Rose accent, for the one brand moment per view. */
  rose:
    "bg-[linear-gradient(180deg,#c25a73_0%,#a8445c_60%,#8e3249_100%)] text-on-rose " +
    "shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_12px_26px_-10px_rgb(142_50_73/0.6)]",
  /** Light pill on top of video or photography. */
  media: "bg-[#fffaf8] text-media-ink shadow-[inset_0_1px_0_white,0_12px_36px_-14px_rgb(22_10_16/0.7)] hover:bg-white",
  /** Translucent pill on top of video or photography. */
  mediaGhost:
    "border border-on-media/35 bg-on-media/12 text-on-media backdrop-blur-md shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] hover:bg-on-media/22 hover:border-on-media/60",
  /** Secondary: soft white pill. */
  outline:
    "btn-soft bg-white/90 text-ink shadow-[inset_0_1px_0_white,0_1px_2px_rgb(37_22_29/0.06),0_8px_20px_-10px_rgb(74_32_46/0.35)] hover:bg-white",
  /** Quiet icon or text button for toolbars (dashboards). */
  ghost: "text-foreground/80 hover:bg-white/8 hover:text-foreground",
} as const;

/*
 * Heights are minimums: a label longer than the screen wraps onto a second line inside the pill
 * instead of pushing the page sideways (iPhone, 2026-11-10).
 */
const sizes = {
  icon: "size-10 p-0",
  xs: "min-h-8 px-3 py-1 text-xs",
  sm: "min-h-10 px-4 py-2 text-sm",
  md: "min-h-12 px-6 py-2.5 text-[0.95rem]",
  lg: "min-h-14 px-7 py-3 text-base",
} as const;

type StyleProps = { variant?: keyof typeof variants; size?: keyof typeof sizes; className?: string };

export function buttonClass({ variant = "solid", size = "md", className }: StyleProps = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant,
  size,
  className,
  ...props
}: StyleProps & ComponentProps<"button">) {
  return <button type="button" className={buttonClass({ variant, size, className })} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...props
}: StyleProps & ComponentProps<typeof Link> & { children: ReactNode }) {
  return (
    <Link className={buttonClass({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}

/** The round arrow inside a pill (owner's picture 4): pair it with a solid or rose button. */
export function ArrowDot({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "-me-2 grid size-7 shrink-0 place-items-center rounded-full shadow-[0_2px_6px_rgb(0_0_0/0.25)] transition-transform duration-500 ease-(--ease-soft) group-hover/btn:rotate-45 rtl:-scale-x-100 rtl:group-hover/btn:-rotate-45",
        tone === "light" ? "bg-white/95 text-[#25161d]" : "bg-[#25161d] text-white",
        className,
      )}
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 11 11 5M6 5h5v5" />
      </svg>
    </span>
  );
}

/** Segmented control shell (owner's picture 8): white tray, the active item is a glossy black pill. */
export const segmentTray = "inline-flex items-center gap-1 rounded-full bg-white/85 p-1 shadow-[inset_0_1px_0_white,0_10px_26px_-14px_rgb(74_32_46/0.4)]";
export function segmentItem(active: boolean) {
  return cn(
    "rounded-full px-4 py-2 text-sm transition-[background-color,color,box-shadow] duration-300 ease-(--ease-soft)",
    active
      ? "bg-[linear-gradient(180deg,#4a3540,#1d1116)] text-[#fff8f6] shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_8px_16px_-8px_rgb(29_17_22/0.7)]"
      : "text-ink-2 hover:bg-ink/5 hover:text-ink",
  );
}
