"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { categoryArt, type CategorySlug } from "@/config/categories";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { segmentItem, segmentTray } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Tab = "all" | "beauty" | "wellness";
const groups: Record<Tab, CategorySlug[]> = {
  all: ["coiffeuses", "esthetique", "nails", "massage", "extensions-de-cils", "botox"],
  beauty: ["coiffeuses", "nails", "extensions-de-cils"],
  wellness: ["esthetique", "massage", "botox"],
};
/** Bento placement for the full set; filtered sets use a simple two-column grid. */
const allCells: Record<CategorySlug, string> = {
  coiffeuses: "lg:row-span-2",
  esthetique: "lg:row-span-2",
  nails: "lg:col-span-2",
  massage: "lg:col-span-2",
  "extensions-de-cils": "",
  botox: "",
};
const photo = (slug: CategorySlug) => categoryArt[slug].image.startsWith("/images/hero/");

/** Category bento with tabs (owner's picture 5): label top-start, arrow dot bottom-end. */
export function CategoryBento({
  locale,
  copy,
  categories,
  verifiedOnly,
}: {
  locale: Locale;
  copy: Dictionary["home"]["bento"];
  categories: Dictionary["categories"];
  verifiedOnly: string;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const reduce = useReducedMotion();
  const slugs = groups[tab];
  const full = tab === "all";

  return (
    <section aria-labelledby="bento-title" className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8 md:py-24 lg:px-12">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <h2 id="bento-title" className="type-display text-[clamp(2.4rem,4.6vw,4rem)]">
          {copy.title}
        </h2>
        <div role="tablist" aria-label={copy.title} className={segmentTray}>
          {(Object.keys(groups) as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={segmentItem(tab === t)}>
              {copy.tabs[t]}
            </button>
          ))}
        </div>
      </div>

      <LayoutGroup>
        <ul className={cn("grid auto-rows-[15rem] gap-4 sm:grid-cols-2 lg:auto-rows-[14.5rem]", full ? "lg:grid-cols-4" : "lg:grid-cols-4")}>
          {slugs.map((slug, i) => (
            <motion.li
              key={slug}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className={cn("group relative", full ? allCells[slug] : i === 0 ? "lg:col-span-2 lg:row-span-2" : "lg:col-span-2")}
            >
              <Link href={`/${locale}/${slug}`} className="absolute inset-0 block overflow-hidden rounded-[26px] shadow-(--shadow-soft)">
                <Image
                  src={categoryArt[slug].image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-[1.2s] ease-(--ease-soft) group-hover:scale-[1.05]"
                />
                {photo(slug) && <div className="absolute inset-0 bg-linear-to-b from-[rgb(var(--scrim)/0.4)] via-transparent to-[rgb(var(--scrim)/0.2)]" />}
                <div className={cn("absolute inset-x-5 top-5", photo(slug) ? "text-white [text-shadow:0_1px_10px_rgb(0_0_0/0.35)]" : "text-media-ink")}>
                  <h3 className="type-display text-[clamp(1.6rem,2.2vw,2.1rem)]">{categories[slug].name}</h3>
                  {categoryArt[slug].regulated && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs">
                      <ShieldCheck className="size-3.5" strokeWidth={1.75} />
                      {verifiedOnly}
                    </p>
                  )}
                </div>
                <span className="absolute end-4 bottom-4 grid size-11 place-items-center rounded-full bg-white/95 text-ink shadow-[0_8px_18px_-8px_rgb(0_0_0/0.5)] transition-transform duration-500 ease-(--ease-soft) group-hover:rotate-45 rtl:group-hover:-rotate-45">
                  <ArrowUpRight className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
                  <span className="sr-only">{copy.open}</span>
                </span>
              </Link>
            </motion.li>
          ))}
          <motion.li layout={!reduce} className={cn("group relative", full ? "lg:col-span-2" : "sm:col-span-2 lg:col-span-2")}>
            <Link href={`/${locale}/about-services`} className="card-soft absolute inset-0 flex flex-col justify-between rounded-[26px] p-6">
              <span>
                <span className="block text-xl font-medium">{copy.proTitle}</span>
                <span className="mt-2 block max-w-[22rem] text-ink-2">{copy.proBody}</span>
              </span>
              <span className="grid size-11 place-items-center self-end rounded-full bg-[linear-gradient(180deg,#c25a73,#8e3249)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_10px_20px_-8px_rgb(142_50_73/0.6)] transition-transform duration-500 ease-(--ease-soft) group-hover:rotate-45 rtl:group-hover:-rotate-45">
                <ArrowUpRight className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
              </span>
            </Link>
          </motion.li>
        </ul>
      </LayoutGroup>
    </section>
  );
}
