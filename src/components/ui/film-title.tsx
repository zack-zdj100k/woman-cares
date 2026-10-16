import type { ElementType } from "react";
import { cn } from "@/lib/cn";
import { MaskedHeading } from "./masked-heading";

/**
 * Section and page titles drawn with MaskedHeading: the letters are windows onto a photograph,
 * tinted wine-rose so they stay readable on the parchment, with a fine rose outline.
 */
export function FilmTitle({
  text,
  id,
  as = "h2",
  image = "/images/hero/chapter-25.jpg",
  className,
  align = "start",
  reveal = "rise",
}: {
  text: string;
  id?: string;
  as?: ElementType;
  image?: string;
  className?: string;
  align?: "start" | "center" | "end";
  reveal?: "rise" | "scale" | "blur" | "wipe" | "fade";
}) {
  return (
    <MaskedHeading
      text={text}
      id={id}
      tag={as}
      src={image}
      tint="#8e3249"
      brightness={0.78}
      saturation={1.15}
      fillScale={1.35}
      parallax={14}
      drift={0}
      outline
      outlineColor="rgb(142 50 73 / 0.45)"
      outlineWidth={0.7}
      reveal={reveal}
      align={align}
      className={cn("type-display text-ink", className)}
    />
  );
}
