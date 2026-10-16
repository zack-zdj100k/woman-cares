import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { getDictionary, getPagesDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { PageShell } from "@/components/layout/page-shell";
import { Reveal } from "@/components/marketing/reveal";
import { SearchChip } from "@/components/marketing/search-chip";
import { MaskedHeading } from "@/components/ui/masked-heading";
import { GlassCardsTrack } from "@/components/ui/glass-cards";

export async function generateMetadata(): Promise<Metadata> {
  const pages = await getPagesDictionary(await getLocale());
  return { title: pages.aboutPlatform.metaTitle, description: pages.aboutPlatform.intro };
}

/*
 * Notre histoire (owner's picture 6): cinematic warm-dark panels with a champagne accent, set on the
 * floral page so the site itself stays light. Copy comes from the existing about text only.
 */
const panel = "relative overflow-hidden rounded-[36px] bg-[#1d1316] text-[#f3e6da] shadow-(--shadow-float)";
const glow = "pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_20%,rgb(217_184_143/0.16),transparent_70%)]";
const champagne = "bg-[linear-gradient(180deg,#e8cfaa,#c9a57a)] text-[#2a1a12] shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_12px_26px_-12px_rgb(201_165_122/0.7)]";
const circles = ["/images/hero/chapter-3.jpg", "/images/hero/chapter-17.jpg", "/images/hero/chapter-25.jpg", "/images/hero/chapter-10.jpg"];

export default async function AboutPlatformPage() {
  const locale = await getLocale();
  const [dict, pages] = await Promise.all([getDictionary(locale), getPagesDictionary(locale)]);
  const a = pages.aboutPlatform;
  const universe = a.sections.slice(1, 5);
  const philosophy = [a.sections[5], a.sections[6]];

  return (
    <PageShell>
      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-6 px-4 pt-4 pb-20 sm:px-8 lg:px-12">
        {/* Hero */}
        <section className={`${panel} grid min-h-[36rem] grid-cols-[minmax(0,1fr)] lg:grid-cols-2`}>
          <div className={glow} />
          <div className="relative order-2 flex flex-col justify-center gap-6 p-8 sm:p-12 lg:order-1 lg:p-16">
            <p className="text-sm tracking-[0.02em] text-[#d9b88f]">{a.eyebrow}</p>
            <MaskedHeading
              tag="h1"
              text={a.title}
              src="/images/hero/chapter-25.jpg"
              tint="#e3c9a3"
              brightness={1.05}
              fillScale={1.3}
              parallax={14}
              drift={0}
              outline
              outlineColor="rgb(227 201 163 / 0.35)"
              outlineWidth={0.6}
              reveal="blur"
              className="type-display text-[clamp(2.3rem,4.4vw,4rem)] text-[#f3e6da]"
            />
            <p className="max-w-[34rem] text-lg leading-relaxed text-[#f3e6da]/75">{a.intro}</p>
            <div className="flex flex-wrap gap-3">
              <SearchChip className={`inline-flex h-12 items-center gap-2 rounded-full px-6 font-medium transition-transform hover:-translate-y-px ${champagne}`}>
                {a.ctaClient}
                <ArrowUpRight className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
              </SearchChip>
              <Link href={`/${locale}/about-services`} className="inline-flex h-12 items-center gap-2 rounded-full border border-[#f3e6da]/25 px-6 text-[#f3e6da] transition-colors hover:bg-white/5">
                {a.ctaPro}
              </Link>
            </div>
          </div>
          <div className="relative order-1 min-h-[18rem] lg:order-2">
            <Image src="/images/hero/chapter-25.jpg" alt="" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-[#1d1316] via-[#1d1316]/10 to-transparent lg:bg-linear-to-r rtl:lg:bg-linear-to-l" />
          </div>
        </section>

        {/* Why we created it: the story reads sideways in glass cards (owner's request). */}
        <h2 id="story-title" className="sr-only">
          {a.story.title}
        </h2>
        <GlassCardsTrack
          label={a.story.title}
          hint={a.story.hint}
          rtl={locale === "ar"}
          cards={[
            {
              id: "start",
              kicker: a.story.kickers[0],
              title: a.story.title,
              body: <p className="type-display text-[clamp(1.35rem,2vw,1.7rem)] leading-snug text-rose-ink italic">{a.story.lead}</p>,
              color: "rgba(168, 68, 92, 0.8)",
            },
            ...a.story.paragraphs.map((p, i) => ({
              id: `p${i}`,
              kicker: a.story.kickers[i + 1],
              body: <p>{p}</p>,
              color: i % 2 ? "rgba(201, 165, 122, 0.8)" : "rgba(194, 90, 115, 0.8)",
            })),
            {
              id: "photos",
              kicker: a.story.kickers[4],
              color: "rgba(201, 165, 122, 0.8)",
              media: (
                <>
                  <Image src="/images/hero/chapter-10.jpg" alt="" fill sizes="34rem" className="object-cover" />
                  <span className="absolute end-4 bottom-4 aspect-square w-[38%] overflow-hidden rounded-full border-4 border-white shadow-(--shadow-float)">
                    <Image src="/images/hero/chapter-17.jpg" alt="" fill sizes="14rem" className="object-cover" />
                  </span>
                </>
              ),
            },
          ]}
        />

        <section aria-labelledby="promises-title" className="px-2 pb-14 [text-shadow:0_1px_14px_rgb(255_250_246/0.95)] sm:px-6 md:pb-20 lg:px-10">
          <h2 id="promises-title" className="type-display text-[clamp(1.9rem,3.2vw,2.6rem)] text-ink">{a.story.promisesTitle}</h2>
          <ul className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {a.story.promises.map((p, i) => (
              <Reveal as="li" key={p.title} delay={i * 0.08} className="border-t border-ink/15 pt-5">
                <p className="type-display text-3xl text-rose" dir="ltr">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p className="mt-2 text-lg font-medium text-ink">{p.title}</p>
                <p className="mt-2 leading-relaxed text-ink-2">{p.body}</p>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* What we built: four circles */}
        <section aria-labelledby="universe-title" className={`${panel} px-6 py-14 text-center sm:px-10 md:py-20`}>
          <div className={glow} />
          <h2 id="universe-title" className="type-display relative text-[clamp(2.2rem,4vw,3.4rem)]">
            {a.universeTitle}
          </h2>
          <p className="relative mx-auto mt-3 max-w-[34rem] text-[#f3e6da]/70">{a.universeBody}</p>
          <ul className="relative mt-12 grid grid-cols-[minmax(0,1fr)] gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {universe.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.08} className="grid justify-items-center gap-4">
                <span className="relative block aspect-square w-[min(13rem,60vw)] overflow-hidden rounded-full shadow-[0_0_0_1px_rgb(217_184_143/0.35),0_30px_60px_-30px_rgb(0_0_0/0.8)]">
                  <Image src={circles[i]} alt="" fill sizes="13rem" className="object-cover transition-transform duration-[1.2s] ease-(--ease-soft) hover:scale-105" />
                </span>
                <h3 className="type-display text-[1.65rem]">{s.title}</h3>
                <p className="max-w-[19rem] text-sm leading-relaxed text-[#f3e6da]/70">{s.body}</p>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* Before / after */}
        <section aria-labelledby="shift-title" className={`${panel} px-6 py-14 sm:px-10 md:py-20`}>
          <div className={glow} />
          <h2 id="shift-title" className="type-display relative mx-auto max-w-[44rem] text-center text-[clamp(2.1rem,3.8vw,3.2rem)] italic">
            {a.shiftTitle}
          </h2>
          <div className="relative mt-12 grid grid-cols-[minmax(0,1fr)] items-center gap-5 lg:grid-cols-[1fr_auto_1fr]">
            {[
              { list: a.before, image: "/images/hero/chapter-10.jpg", dim: "bg-[#1d1316]/80" },
              { list: a.after, image: "/images/hero/chapter-3.jpg", dim: "bg-[#1d1316]/55" },
            ].map(({ list, image, dim }, i) => (
              <Reveal key={list.title} delay={i * 0.1} className={i === 1 ? "lg:order-3" : ""}>
                <p className="type-display mb-4 text-3xl text-[#d9b88f]">{list.title}</p>
                <div className="relative overflow-hidden rounded-[26px] border border-[#d9b88f]/20">
                  <Image src={image} alt="" fill sizes="(min-width: 1024px) 40vw, 100vw" className={i === 0 ? "object-cover grayscale" : "object-cover"} />
                  <div className={`absolute inset-0 ${dim}`} />
                  <ul className="relative grid gap-3 p-7 md:p-9">
                    {list.items.map((it) => (
                      <li key={it} className="flex items-center gap-3 text-[1.02rem]">
                        <span aria-hidden="true" className="text-[#d9b88f]">›</span>
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
            <ArrowRight aria-hidden="true" className="mx-auto size-7 rotate-90 text-[#d9b88f] lg:order-2 lg:rotate-0 rtl:lg:rotate-180" strokeWidth={1.25} />
          </div>
        </section>

        {/* Philosophy */}
        <section aria-labelledby="philosophy-title" className={`${panel} grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]`}>
          <div className={glow} />
          <div className="relative p-8 sm:p-12 lg:p-16">
            <h2 id="philosophy-title" className="type-display text-[clamp(2.2rem,4vw,3.4rem)]">
              {a.philosophyTitle}
            </h2>
            <ul className="mt-8 grid gap-6">
              {philosophy.map((s) => (
                <Reveal as="li" key={s.title}>
                  <p className="font-medium text-[#d9b88f]">{s.title}</p>
                  <p className="mt-1.5 max-w-[38rem] leading-relaxed text-[#f3e6da]/75">{s.body}</p>
                </Reveal>
              ))}
            </ul>
            <p lang="en" dir="ltr" className="mt-10 font-[family-name:var(--font-cormorant)] text-[clamp(1.8rem,3vw,2.6rem)] italic text-[#f3e6da]">
              {dict.brand.signature}
            </p>
          </div>
          <div className="relative min-h-[22rem]">
            <Image src="/images/hero/pro-cta-nails.jpg" alt="" fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-[#1d1316] to-transparent lg:bg-linear-to-r rtl:lg:bg-linear-to-l" />
          </div>
        </section>
      </div>
    </PageShell>
  );
}
