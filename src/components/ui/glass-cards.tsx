"use client";

/*
 * Glass cards, adapted from the "Stacking Glass Cards with GSAP" component the owner supplied.
 * Kept: the glass card (conic "electric" border, top reflection, shine line, side reflection, frosted
 * texture) and GSAP ScrollTrigger. Changed for this site:
 *  - the cards travel sideways (owner: "scroll from left to right to read"): the section pins and
 *    vertical scrolling moves the track; Arabic moves the other way;
 *  - no backdrop blur (scroll performance), light glass suited to the floral page;
 *  - cleanup kills only this component's triggers (the original killed every trigger on the page);
 *  - phones and reduced motion get a native swipe row instead of pinning; content comes from props.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export type GlassCard = { id: string; kicker?: string; title?: string; body?: ReactNode; media?: ReactNode; color: string };

function Card({ card, index, total }: { card: GlassCard; index: number; total: number }) {
  return (
    <article
      data-glass-card
      className="relative isolate flex h-[min(30rem,72dvh)] w-[min(34rem,84vw)] shrink-0 snap-center rounded-[24px]"
      aria-roledescription="carte"
      aria-label={`${index + 1} / ${total}`}
    >
      {/* Electric border */}
      <div
        aria-hidden="true"
        className="absolute -inset-[3px] -z-10 rounded-[27px]"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${card.color} 60deg, ${card.color.replace("0.8", "0.6")} 120deg, transparent 180deg, ${card.color.replace("0.8", "0.4")} 240deg, transparent 360deg)`,
        }}
      />
      {/* Glass body: light, no live blur */}
      <div
        className="relative flex size-full flex-col overflow-hidden rounded-[24px] border border-white/60 p-7 sm:p-9"
        style={{
          background: "linear-gradient(145deg, rgba(255, 252, 249, 0.94), rgba(255, 246, 242, 0.86))",
          boxShadow: "0 18px 44px -20px rgba(74, 32, 46, 0.45), 0 2px 8px rgba(74, 32, 46, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(255, 255, 255, 0.4)",
        }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[60%] rounded-t-[24px] bg-[linear-gradient(135deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.15)_50%,transparent_100%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-2.5 top-2.5 h-0.5 rounded-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.95)_50%,transparent_100%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-0 w-0.5 bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,transparent_50%)]" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[24px] opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(168,68,92,0.06) 1px, transparent 2px), radial-gradient(circle at 80% 70%, rgba(168,68,92,0.05) 1px, transparent 2px), radial-gradient(circle at 40% 80%, rgba(168,68,92,0.04) 1px, transparent 2px)",
            backgroundSize: "30px 30px, 25px 25px, 35px 35px",
          }}
        />

        <div className="relative flex items-center justify-between gap-4 text-sm">
          {card.kicker ? <span className="text-rose-ink">{card.kicker}</span> : <span />}
          <span className="tabular-nums text-ink-2" dir="ltr">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
        {card.media ? (
          <div className="relative mt-5 flex-1 overflow-hidden rounded-[18px]">{card.media}</div>
        ) : (
          <div className="relative my-auto py-4">
            {card.title && <h3 className="type-display text-[clamp(2rem,3.4vw,3rem)] text-ink">{card.title}</h3>}
            {card.body && <div className="mt-5 text-[clamp(1.02rem,1.3vw,1.15rem)] leading-relaxed text-ink">{card.body}</div>}
          </div>
        )}
      </div>
    </article>
  );
}

/** A pinned row of glass cards that scrolls sideways as the page scrolls down. */
export function GlassCardsTrack({ cards, label, hint, rtl }: { cards: GlassCard[]; label: string; hint: string; rtl: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!section || !viewport || !track) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        setPinned(true);
        const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
        const move = gsap.to(track, {
          x: () => (rtl ? 1 : -1) * distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            pin: true,
            start: "center center",
            end: () => `+=${distance()}`,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              if (barRef.current) barRef.current.style.transform = `scaleX(${self.progress})`;
            },
          },
        });
        // Each card settles from slightly smaller and dimmer as it reaches the centre.
        gsap.utils.toArray<HTMLElement>("[data-glass-card]", track).forEach((el) => {
          gsap.fromTo(
            el,
            { scale: 0.92, opacity: 0.55 },
            {
              scale: 1,
              opacity: 1,
              ease: "none",
              scrollTrigger: { trigger: el, containerAnimation: move, start: rtl ? "right left" : "left right", end: "center center", scrub: true },
            },
          );
        });
        return () => setPinned(false);
      });
    }, section);
    return () => ctx.revert();
  }, [rtl, cards.length]);

  return (
    <section ref={sectionRef} aria-label={label} className="relative flex w-full min-w-0 flex-col justify-center py-6 md:min-h-[min(100dvh,52rem)] md:py-10">
      <div
        ref={viewportRef}
        className={pinned ? "overflow-hidden py-6" : "-mx-4 snap-x snap-mandatory overflow-x-auto px-4 py-6 [scrollbar-width:none] sm:-mx-8 sm:px-8"}
      >
        <div ref={trackRef} className="flex w-max gap-6 will-change-transform md:gap-10 md:px-[8vw]">
          {cards.map((c, i) => (
            <Card key={c.id} card={c} index={i} total={cards.length} />
          ))}
        </div>
      </div>
      <div className="mx-auto mt-4 flex w-[min(20rem,70vw)] items-center gap-3 text-xs text-ink-2">
        <span className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-ink/10">
          <span ref={barRef} className={`absolute inset-0 bg-rose ${rtl ? "origin-right" : "origin-left"}`} style={{ transform: pinned ? "scaleX(0)" : "scaleX(1)" }} />
        </span>
        <span>{hint}</span>
      </div>
    </section>
  );
}
