import { Plus } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { Reveal } from "./reveal";

/** Native <details> accordion: works without JavaScript and with keyboard by default. */
export function Faq({ copy }: { copy: Dictionary["faq"] }) {
  return (
    <section aria-labelledby="faq-title">
      <div className="mx-auto grid grid-cols-[minmax(0,1fr)] max-w-[1480px] gap-12 px-5 py-24 sm:px-8 md:py-32 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:px-14">
        <Reveal>
          <h2 id="faq-title" className="type-display text-[clamp(2.5rem,5vw,4.5rem)] lg:sticky lg:top-28">
            {copy.title}
          </h2>
        </Reveal>
        <div className="grid gap-3">
          {copy.items.map((item, i) => (
            <details key={item.q} className="card-soft group rounded-[24px] px-5 md:px-7">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-start text-lg font-medium transition-colors hover:text-rose-ink md:text-xl [&::-webkit-details-marker]:hidden">
                <span className="flex items-baseline gap-4">
                  <span className="text-sm tabular-nums text-ink-2" dir="ltr">{String(i + 1).padStart(2, "0")}</span>
                  {item.q}
                </span>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white shadow-[inset_0_1px_0_white,0_6px_14px_-8px_rgb(74_32_46/0.5)] transition-[transform,background-color,color] duration-500 ease-(--ease-soft) group-open:rotate-45 group-open:bg-ink group-open:text-white">
                  <Plus className="size-4" strokeWidth={1.75} />
                </span>
              </summary>
              <p className="max-w-[44rem] pb-6 ps-10 text-[1.02rem] leading-relaxed text-ink-2">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
