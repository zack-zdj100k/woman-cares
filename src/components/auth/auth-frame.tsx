import Image from "next/image";
import type { ReactNode } from "react";

/** Form on one side, a still from the owner's film on the other (desktop only). */
export function AuthFrame({
  title,
  intro,
  image = "/images/hero/chapter-25.jpg",
  imagePosition = "50% 50%",
  children,
  footer,
}: {
  title: string;
  intro?: string;
  image?: string;
  imagePosition?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-[1480px] gap-12 px-5 pt-10 pb-24 sm:px-8 md:pt-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16 lg:px-14">
      <div className="mx-auto w-full max-w-[34rem] lg:mx-0">
        <h1 className="type-display text-[clamp(2.6rem,5vw,4.25rem)]">{title}</h1>
        {intro && <p className="mt-4 text-lg leading-relaxed text-ink-2">{intro}</p>}
        <div className="mt-10">{children}</div>
        {footer && <div className="mt-8 text-[0.95rem] text-ink-2">{footer}</div>}
      </div>
      <div className="relative hidden min-h-[36rem] overflow-hidden rounded-(--radius-media) lg:block">
        <Image src={image} alt="" fill sizes="40vw" className="object-cover" style={{ objectPosition: imagePosition }} />
      </div>
    </div>
  );
}
