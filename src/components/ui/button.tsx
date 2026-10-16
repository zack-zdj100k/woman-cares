import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shape rule (docs/DESIGN.md): every interactive control is a full pill;
 * media and cards use --radius-media; fields use --radius-field.
 */
const base =
  "group/btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium " +
  "transition-[background-color,color,border-color,transform,box-shadow] duration-300 ease-(--ease-soft) " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

const variants = {
  /** Brand accent. */
  solid: "bg-rose text-on-rose hover:bg-rose-ink shadow-[0_10px_30px_-12px_rgb(168_68_92/0.6)]",
  /** Light pill on top of video or photography. */
  media: "bg-on-media text-media-ink hover:bg-white shadow-[0_12px_40px_-14px_rgb(22_10_16/0.7)]",
  /** Translucent pill on top of video or photography. */
  mediaGhost:
    "border border-on-media/35 bg-on-media/10 text-on-media backdrop-blur-md hover:bg-on-media/20 hover:border-on-media/60",
  /** Quiet outline on page surfaces. */
  outline: "border border-ink/20 text-ink hover:border-ink/60 hover:bg-ink/5",
} as const;

const sizes = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-6 text-[0.95rem]",
  lg: "h-14 px-7 text-base",
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
