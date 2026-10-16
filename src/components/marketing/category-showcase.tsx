import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { categoryArt, type CategorySlug } from "@/config/categories";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { Reveal } from "./reveal";
import { cn } from "@/lib/cn";

/*
 * Six cells, six categories. Photography for the four filmed categories;
 * the two categories without footage yet use the owner's illustrated frames
 * as invitation-card tiles (replaceable from the CMS later).
 */
const layout: Record<CategorySlug, { cell: string; kind: "photo" | "frame"; frame?: string; dark?: boolean }> = {
  coiffeuses: { cell: "md:col-span-2 lg:col-span-7 lg:row-span-2 min-h-[22rem] lg:min-h-[36rem]", kind: "photo" },
  esthetique: { cell: "lg:col-span-5 min-h-[17rem]", kind: "photo" },
  nails: { cell: "lg:col-span-5 min-h-[17rem]", kind: "photo" },
  massage: { cell: "md:col-span-2 lg:col-span-6 min-h-[19rem]", kind: "photo" },
  "extensions-de-cils": {
    cell: "lg:col-span-3 min-h-[24rem]",
    kind: "frame",
    frame: "/images/backgrounds/blush-butterflies.jpg",
  },
  botox: { cell: "lg:col-span-3 min-h-[24rem]", kind: "frame", frame: "/images/backgrounds/lavender-garland.jpg" },
};

const order: CategorySlug[] = ["coiffeuses", "esthetique", "nails", "massage", "extensions-de-cils", "botox"];

export function CategoryShowcase({
  locale,
  copy,
  categories,
}: {
  locale: Locale;
  copy: Dictionary["showcase"];
  categories: Dictionary["categories"];
}) {
  return (
    <section aria-labelledby="showcase-title" className="mx-auto max-w-[1480px] px-5 py-24 sm:px-8 md:py-32 lg:px-14">
      <Reveal className="mb-12 max-w-[40rem] md:mb-16">
        <h2 id="showcase-title" className="type-display text-[clamp(2.5rem,5vw,4.5rem)]">
          {copy.title}
        </h2>
        <p className="mt-4 text-lg text-ink-2">{copy.body}</p>
      </Reveal>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 lg:gap-5">
        {order.map((slug, i) => {
          const spec = layout[slug];
          const text = categories[slug];
          return (
            <Reveal as="li" key={slug} delay={i * 0.06} className={cn("group relative", spec.cell)}>
              <Link
                href={`/${locale}/${slug}`}
                className="absolute inset-0 block overflow-hidden rounded-(--radius-media) focus-visible:outline-offset-4"
              >
                {spec.kind === "photo" ? (
                  <>
                    <Image
                      src={categoryArt[slug].image}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 50vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform duration-[1.2s] ease-(--ease-soft) group-hover:scale-[1.05]"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-[rgb(var(--scrim)/0.75)] via-[rgb(var(--scrim)/0.15)] to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-6 text-on-media md:p-8">
                      <div>
                        <h3 className="type-display text-[clamp(2rem,3.2vw,3.25rem)]">{text.name}</h3>
                        <p className="mt-2 max-w-[26rem] text-[0.95rem] text-on-media/85">{text.short}</p>
                      </div>
                      <span className="grid size-12 shrink-0 place-items-center rounded-full border border-on-media/35 bg-on-media/10 backdrop-blur-md transition-[background-color,color,transform] duration-500 ease-(--ease-soft) group-hover:-rotate-45 group-hover:bg-on-media group-hover:text-media-ink rtl:group-hover:rotate-45">
                        <ArrowUpRight className="size-5 rtl:-scale-x-100" strokeWidth={1.5} />
                        <span className="sr-only">{copy.cta}</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <Image
                      src={spec.frame!}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform duration-[1.2s] ease-(--ease-soft) group-hover:scale-[1.04]"
                    />
                    <div
                      className={cn(
                        "absolute inset-0 grid place-content-center gap-3 px-12 text-center",
                        spec.dark ? "text-[#f3e6d8]" : "text-media-ink",
                      )}
                    >
                      <h3 className="type-display text-[clamp(1.9rem,2.4vw,2.5rem)] leading-[1.05]">{text.name}</h3>
                      <p className={cn("mx-auto max-w-[13rem] text-sm", spec.dark ? "text-[#f3e6d8]/85" : "text-media-ink/75")}>
                        {text.short}
                      </p>
                      {categoryArt[slug].regulated && (
                        <p className="mx-auto mt-1 inline-flex items-center gap-1.5 text-xs">
                          <ShieldCheck className="size-3.5" strokeWidth={1.75} />
                          {copy.verifiedOnly}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </Link>
            </Reveal>
          );
        })}
      </ul>
    </section>
  );
}
