"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Dictionary } from "@/i18n/dictionaries/fr";

/** Four verbs on one drawn line: the journey from discovery to a confirmed appointment. */
export function HowItWorks({ copy }: { copy: Dictionary["how"] }) {
  const reduce = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <section aria-labelledby="how-title" className="mx-auto max-w-[1480px] px-5 py-24 sm:px-8 md:py-32 lg:px-14">
      <h2 id="how-title" className="type-display mb-16 text-[clamp(2.5rem,5vw,4.5rem)]">
        {copy.title}
      </h2>

      <ol className="relative grid gap-12 md:grid-cols-4 md:gap-8">
        {/* The line draws itself across (desktop) or down (mobile). */}
        <motion.span
          aria-hidden="true"
          className="absolute start-[7px] top-2 bottom-2 w-px origin-top bg-rose/40 md:inset-x-0 md:top-[7px] md:bottom-auto md:h-px md:w-auto md:origin-left rtl:md:origin-right"
          initial={reduce ? false : { scaleX: 0, scaleY: 0 }}
          whileInView={{ scaleX: 1, scaleY: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1.4, ease }}
        />
        {copy.steps.map((step, i) => (
          <motion.li
            key={step.title}
            className="relative ps-10 md:ps-0 md:pt-12"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.8, delay: 0.2 + i * 0.15, ease }}
          >
            <span
              aria-hidden="true"
              className="absolute start-0 top-1 size-[15px] rounded-full border border-rose bg-ground md:top-0"
            >
              <span className="absolute inset-[4px] rounded-full bg-rose" />
            </span>
            <h3 className="type-display text-[2.4rem]">{step.title}</h3>
            <p className="mt-3 max-w-[22rem] text-base leading-relaxed text-ink-2 md:text-[1.05rem]">{step.body}</p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
