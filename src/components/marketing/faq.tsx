import { Plus } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { Reveal } from "./reveal";

/** Native <details> accordion: works without JavaScript and with keyboard by default. */
export function Faq({ copy }: { copy: Dictionary["faq"] }) {
  return (
    <section aria-labelledby="faq-title" className="bg-surface">
      <div className="mx-auto grid max-w-[1480px] gap-12 px-5 py-24 sm:px-8 md:py-32 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:px-14">
        <Reveal>
          <h2 id="faq-title" className="type-display text-[clamp(2.5rem,5vw,4.5rem)] lg:sticky lg:top-28">
            {copy.title}
          </h2>
        </Reveal>
        <div className="divide-y divide-line border-y border-line">
          {copy.items.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-start text-lg font-medium transition-colors hover:text-rose-ink md:text-xl [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-ink/15 transition-[transform,background-color] duration-500 ease-(--ease-soft) group-open:rotate-45 group-open:bg-ink group-open:text-ground">
                  <Plus className="size-4" strokeWidth={1.75} />
                </span>
              </summary>
              <p className="max-w-[44rem] pb-7 text-[1.05rem] leading-relaxed text-ink-2">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
