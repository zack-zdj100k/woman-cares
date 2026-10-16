import type { Dictionary } from "@/i18n/dictionaries/fr";
import { FilmTitle } from "@/components/ui/film-title";
import { Reveal } from "./reveal";

/** Four reasons around a ringed centre (owner's picture 5, "why us"). */
export function WhyUs({ copy }: { copy: Dictionary["home"]["why"] }) {
  const total = String(copy.items.length).padStart(2, "0");
  const card = (item: { title: string; body: string }, i: number) => (
    <Reveal key={item.title} delay={i * 0.08} className="card-soft rounded-[26px] p-6">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-medium leading-snug">{item.title}</h3>
        <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-xs tabular-nums shadow-[inset_0_1px_0_white]" dir="ltr">
          <span className="text-ink">{String(i + 1).padStart(2, "0")}</span> <span className="text-ink-2/60">{total}</span>
        </span>
      </div>
      <p className="mt-6 text-[0.95rem] leading-relaxed text-ink-2">{item.body}</p>
    </Reveal>
  );
  return (
    <section aria-labelledby="why-title" className="mx-auto max-w-[1200px] px-4 py-20 sm:px-8 md:py-28">
      <div className="relative grid grid-cols-[minmax(0,1fr)] items-center gap-5 lg:grid-cols-[1fr_minmax(16rem,22rem)_1fr]">
        <div className="grid gap-5 lg:order-1 lg:gap-24">
          {copy.items.slice(0, 2).map((it, i) => card(it, i))}
        </div>
        <div className="relative order-first mx-auto grid aspect-square w-full max-w-[20rem] place-items-center lg:order-2 lg:max-w-none">
          {[100, 78, 56].map((s) => (
            <span key={s} aria-hidden="true" className="absolute rounded-full border border-ink/12" style={{ width: `${s}%`, height: `${s}%` }} />
          ))}
          <FilmTitle id="why-title" text={copy.title} align="center" image="/images/hero/chapter-17.jpg" className="relative max-w-[15rem] text-[clamp(2.2rem,3.6vw,3.2rem)]" />
        </div>
        <div className="grid gap-5 lg:order-3 lg:gap-24">
          {copy.items.slice(2).map((it, i) => card(it, i + 2))}
        </div>
      </div>
    </section>
  );
}
