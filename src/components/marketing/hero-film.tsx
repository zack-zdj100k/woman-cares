"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import {
  HERO_FILM_SEEK_OFFSET,
  heroFilmChapters,
  type CategorySlug,
} from "@/config/categories";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { buttonClass } from "@/components/ui/button";
import { useFindCare } from "./find-care";
import { Typewriter } from "./typewriter";
import { cn } from "@/lib/cn";

/*
 * Hero film. One video (four crossfaded clips: hair, skin, nails, massage)
 * pinned while the visitor scrolls through ~2 screens:
 *
 *   0.00 - 0.28  the inset, rounded frame opens to full bleed; headline lines drift apart
 *   0.00 - 1.00  each quarter of the scroll is one category chapter; entering a quarter
 *                seeks the film to that chapter (and the chapter UI follows the film
 *                when it simply plays)
 *   0.55 - 0.70  headline and CTAs hand over to a large chapter title
 *
 * Reduced motion: no autoplay, no pinning, no frame animation. The film can still
 * be started with the play button and chapters are still selectable.
 */

import { chapterAt, progressWithin, starts, map, ENGAGED } from "@/lib/hero-film";

type Chapter = { slug: CategorySlug; name: string; caption: string; image: string };

export function HeroFilm({
  locale,
  copy,
  chapters,
}: {
  locale: Locale;
  copy: Dictionary["hero"];
  chapters: Chapter[];
}) {
  const reduce = useReducedMotion() ?? false;
  const findCare = useFindCare();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chapterRef = useRef(0);
  const scrollChapterRef = useRef(0);
  const userPausedRef = useRef(false);

  const [chapter, setChapter] = useState(0);
  const [paused, setPaused] = useState(true);
  const [inView, setInView] = useState(true);

  const fill = useMotionValue(0);
  const filmOpacity = useMotionValue(1);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const p = scrollYProgress;

  // Frame: inset rounded card (Norvik reference) opening to a full-bleed film.
  const inset = useTransform(p, map([0, 0.28], [14, 0]));
  const radius = useTransform(p, map([0, 0.28], [28, 0]));
  const clipPath = useMotionTemplate`inset(${inset}px round ${radius}px)`;
  const filmScale = useTransform(p, map([0, 1], [1.08, 1]));

  // Headline choreography; RTL drifts mirror LTR.
  const dir = locale === "ar" ? -1 : 1;
  const lineA = useTransform(p, (v) => `${map([0, 0.6], [0, -5 * dir])(v)}%`);
  const lineB = useTransform(p, (v) => `${map([0, 0.6], [0, 5 * dir])(v)}%`);
  const introY = useTransform(p, map([0, 0.7], [0, -90]));
  const introOpacity = useTransform(p, map([0.5, 0.66], [1, 0]));
  const introVisibility = useTransform(introOpacity, (o) => (o < 0.02 ? "hidden" : "visible"));
  const cardOpacity = useTransform(p, map([0.46, 0.6], [1, 0]));
  const cardVisibility = useTransform(cardOpacity, (o) => (o < 0.02 ? "hidden" : "visible"));
  const titleOpacity = useTransform(p, map([0.58, 0.72], [0, 1]));
  const titleY = useTransform(p, map([0.58, 0.72], [40, 0]));
  const titleVisibility = useTransform(titleOpacity, (o) => (o < 0.02 ? "hidden" : "visible"));
  const scrim = useTransform(p, map([0.5, 0.75], [0, 0.14]));

  function seek(c: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = starts[c] + (c === 0 ? 0 : HERO_FILM_SEEK_OFFSET);
    chapterRef.current = c;
    setChapter(c);
    if (!reduce) animate(filmOpacity, [0.35, 1], { duration: 0.7, ease: [0.16, 1, 0.3, 1] });
  }

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    if (reduce) return;
    const c = Math.min(heroFilmChapters.length - 1, Math.floor(value * heroFilmChapters.length));
    if (c === scrollChapterRef.current) return;
    scrollChapterRef.current = c;
    if (c !== chapterRef.current) seek(c);
  });

  // Keep chapter UI and the progress fill in sync with the film while it plays. Ten checks a
  // second are enough (the fill eases between them in CSS); a per-frame loop kept phones busy.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !inView) return;
    let timer = 0;
    const tick = () => {
      const t = v.currentTime;
      let c = chapterAt(t);
      // Once the visitor has scrolled into the film, the chapter they are on loops on itself.
      if (!reduce && scrollYProgress.get() > ENGAGED && c !== scrollChapterRef.current && !v.seeking) {
        c = scrollChapterRef.current;
        v.currentTime = starts[c] + (c === 0 ? 0 : HERO_FILM_SEEK_OFFSET);
      }
      if (c !== chapterRef.current) {
        chapterRef.current = c;
        setChapter(c);
      }
      fill.set(progressWithin(t, c));
    };
    const loop = () => {
      tick();
      timer = window.setTimeout(loop, 100);
    };
    const start = () => {
      window.clearTimeout(timer);
      loop();
    };
    const stop = () => {
      window.clearTimeout(timer);
      tick();
    };
    v.addEventListener("play", start);
    v.addEventListener("pause", stop);
    v.addEventListener("seeked", tick);
    if (!v.paused) start();
    else tick();
    return () => {
      window.clearTimeout(timer);
      v.removeEventListener("play", start);
      v.removeEventListener("pause", stop);
      v.removeEventListener("seeked", tick);
    };
  }, [inView, fill, reduce, scrollYProgress]);

  // Pause the film while the hero is off screen; resume unless the visitor paused it.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inView && !userPausedRef.current && !reduce) {
      v.play().catch(() => setPaused(true));
    } else {
      v.pause();
    }
  }, [inView, reduce]);

  /** Rail click: inside the pinned film, scroll to that chapter's quarter; at the top, just seek. */
  function goToChapter(c: number) {
    const el = sectionRef.current;
    if (reduce || !el || scrollYProgress.get() <= ENGAGED) {
      seek(c);
      return;
    }
    const travel = el.offsetHeight - window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + travel * ((c + 0.5) / heroFilmChapters.length), behavior: "smooth" });
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      userPausedRef.current = false;
      v.play().catch(() => setPaused(true));
    } else {
      userPausedRef.current = true;
      v.pause();
    }
  }

  const active = chapters[chapter];

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hero-title"
      className={cn("relative", reduce ? "h-dvh" : "h-[260vh] md:h-[300vh]")}
    >
      <div className="sticky top-0 h-dvh overflow-hidden">
        {/* Film frame */}
        <motion.div
          className="absolute inset-0 overflow-hidden bg-[#e8d3cb]"
          style={reduce ? undefined : { clipPath }}
        >
          <motion.video
            ref={videoRef}
            className="absolute inset-0 size-full object-cover"
            style={{ scale: reduce ? 1 : filmScale, opacity: filmOpacity }}
            poster="/images/hero/chapter-3.jpg"
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
          >
            <source src="/media/hero-woman-cares-960.mp4" type="video/mp4" media="(max-width: 900px)" />
            <source src="/media/hero-woman-cares.mp4" type="video/mp4" />
          </motion.video>

          {/* Scrims: one under the copy side, one under the chapter rail, one global that deepens on scroll. */}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-[rgb(var(--scrim)/0.46)] via-[rgb(var(--scrim)/0.12)] to-transparent rtl:bg-linear-to-l md:via-[rgb(var(--scrim)/0.08)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-[rgb(var(--scrim)/0.42)] to-transparent" />
          <motion.div
            className="pointer-events-none absolute inset-0 bg-[rgb(var(--scrim))]"
            style={{ opacity: reduce ? 0 : scrim }}
          />
        </motion.div>

        {/* Copy */}
        <div className="relative z-10 mx-auto flex h-full max-w-[1480px] flex-col px-5 pb-6 pt-28 text-on-media sm:px-8 md:pb-8 lg:px-14 lg:pt-32">
          <motion.div
            style={reduce ? undefined : { y: introY, opacity: introOpacity, visibility: introVisibility }}
            className="max-w-[44rem] [text-shadow:0_1px_2px_rgb(22_10_16/0.35),0_2px_30px_rgb(22_10_16/0.45)]"
          >
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="mb-5 text-sm tracking-[0.02em] text-on-media/85"
            >
              {copy.eyebrow}
            </motion.p>
            <h1 id="hero-title" className="type-display text-[clamp(3rem,7.4vw,7rem)]">
              <HeadlineLine x={reduce ? 0 : lineA} delay={0.1} reduce={reduce}>
                {copy.titleLines[0]} {copy.titleLines[1]}
              </HeadlineLine>
              <HeadlineLine x={reduce ? 0 : lineB} delay={0.25} reduce={reduce} className="italic text-on-media-accent rtl:not-italic">
                {copy.titleLines[2]}
              </HeadlineLine>
            </h1>
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 max-w-[34rem] text-[1.05rem] leading-relaxed text-on-media/90 md:text-lg"
            >
              {copy.subtitle}
            </motion.p>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <button
                type="button"
                onClick={() => findCare.open(heroFilmChapters[chapter])}
                className={buttonClass({ variant: "media", size: "lg" })}
              >
                {copy.primary}
              </button>
              <Link href={`/${locale}/about-services`} className={buttonClass({ variant: "mediaGhost", size: "lg" })}>
                {copy.secondary}
                <ArrowUpRight
                  className="size-4 transition-transform duration-300 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5 rtl:-scale-x-100"
                  strokeWidth={1.75}
                />
              </Link>
            </motion.div>
          </motion.div>

          {/* Chapter title that takes over once the intro has scrolled away */}
          {!reduce && (
            <motion.div
              style={{ opacity: titleOpacity, y: titleY, visibility: titleVisibility }}
              className="absolute inset-x-5 bottom-28 sm:inset-x-8 md:bottom-32 lg:inset-x-14"
              aria-live="polite"
            >
              <p className="mb-2 text-sm tracking-[0.02em] text-on-media/80">{copy.chapters}</p>
              <p className="type-display pb-[0.12em] text-[clamp(3.5rem,12vw,11rem)] leading-[0.9]">{active.name}</p>
              <div className="mt-5 flex max-w-[40rem] flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <Typewriter key={active.slug} text={active.caption} className="max-w-[28rem] text-base text-on-media/90 md:text-lg" />
                <Link
                  href={`/${locale}/${active.slug}`}
                  prefetch
                  className={buttonClass({ variant: "mediaGhost", size: "md", className: "self-start" })}
                >
                  {copy.explore}
                  <ArrowUpRight className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
                </Link>
              </div>
            </motion.div>
          )}

          <div className="flex-1" />

          {/* Chapter rail + play control */}
          <div className="flex items-end gap-4 md:gap-8">
            <nav aria-label={copy.chapters} className="flex-1">
              <ol className="grid grid-cols-4 gap-2 sm:gap-4">
                {chapters.map((c, i) => (
                  <li key={c.slug}>
                    <button
                      type="button"
                      onClick={() => goToChapter(i)}
                      aria-current={i === chapter ? "true" : undefined}
                      aria-label={`${copy.showChapter} ${c.name}`}
                      className="group/ch block w-full py-2 text-start"
                    >
                      <span className="relative block h-[2px] overflow-hidden rounded-full bg-on-media/25">
                        <ChapterFill fill={fill} active={i === chapter} done={i < chapter} />
                      </span>
                      <span
                        className={cn(
                          "mt-3 block truncate text-xs transition-colors duration-300 sm:text-sm",
                          i === chapter ? "text-on-media" : "text-on-media/60 group-hover/ch:text-on-media/90",
                        )}
                      >
                        {c.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={paused ? copy.play : copy.pause}
              aria-pressed={!paused}
              className="grid size-12 shrink-0 place-items-center rounded-full border border-on-media/35 bg-on-media/10 text-on-media backdrop-blur-md transition-[background-color,transform] duration-300 hover:bg-on-media/25 active:scale-95"
            >
              {paused ? <Play className="size-4 translate-x-px" strokeWidth={1.75} /> : <Pause className="size-4" strokeWidth={1.75} />}
            </button>
          </div>
        </div>

        {/* Floating detail card (Glowence reference): close-up of the current chapter. */}
        <motion.aside
          style={reduce ? undefined : { opacity: cardOpacity, visibility: cardVisibility }}
          className="absolute end-14 top-1/2 z-10 hidden w-[17.5rem] 2xl:end-[max(3.5rem,calc((100vw-1480px)/2+3.5rem))] -translate-y-[40%] overflow-hidden rounded-[22px] xl:block border border-on-media/20 bg-[rgb(var(--scrim)/0.35)] text-on-media shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_30px_80px_-30px_rgb(0_0_0/0.6)] backdrop-blur-xl"
          aria-label={active.name}
        >
          <div className="relative aspect-[4/3] overflow-hidden">
            {chapters.map((c, i) => (
              <Image
                key={c.slug}
                src={c.image}
                alt=""
                fill
                sizes="280px"
                className={cn(
                  "object-cover transition-[opacity,scale] duration-700 ease-(--ease-soft)",
                  i === chapter ? "scale-[2.4] opacity-100" : "scale-[2.7] opacity-0",
                )}
                style={{ objectPosition: closeUps[c.slug], transformOrigin: closeUps[c.slug] }}
              />
            ))}
          </div>
          <div className="grid gap-3 p-5">
            <p className="type-display text-2xl">{active.name}</p>
            <Typewriter key={active.slug} text={active.caption} className="min-h-[4.5rem] text-sm leading-relaxed text-on-media/85" />
            <div>
              <Link
                href={`/${locale}/${active.slug}`}
                prefetch
                className="inline-flex items-center gap-1 text-sm underline decoration-on-media/40 underline-offset-4 transition-colors hover:decoration-on-media"
              >
                {copy.explore}
                <ArrowUpRight className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </motion.aside>
      </div>
      <div id="hero-end" aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px" />
    </section>
  );
}

/** Where each close-up crops into the chapter still (the stylist, the facial, the manicure, the massage). */
const closeUps: Partial<Record<CategorySlug, string>> = {
  coiffeuses: "62% 38%",
  esthetique: "62% 42%",
  nails: "34% 78%",
  massage: "72% 70%",
};

function HeadlineLine({
  children,
  x,
  delay,
  reduce,
  className,
}: {
  children: React.ReactNode;
  x: MotionValue<string> | number;
  delay: number;
  reduce: boolean;
  className?: string;
}) {
  return (
    <motion.span style={{ x }} className={cn("block pb-1", className)}>
      <motion.span
        className="block"
        initial={reduce ? false : { opacity: 0, y: "0.35em", filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}

function ChapterFill({ fill, active, done }: { fill: MotionValue<number>; active: boolean; done: boolean }) {
  return (
    <motion.span
      className="absolute inset-0 origin-left rounded-full bg-on-media transition-transform duration-100 ease-linear rtl:origin-right motion-reduce:transition-none"
      style={{ scaleX: active ? fill : done ? 1 : 0 }}
    />
  );
}
