"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, type MotionValue } from "motion/react";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { heroFilmChapters, type CategorySlug } from "@/config/categories";
import { heroScenes, type HeroScene } from "@/config/hero-scenes";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { buttonClass } from "@/components/ui/button";
import { useFindCare } from "./find-care";
import { Typewriter } from "./typewriter";
import { cn } from "@/lib/cn";

/*
 * Home hero. A full-screen gallery of four salon scenes (hair, skin, nails, massage), one clip each.
 * The page is locked on it: one scroll gesture (wheel, swipe, arrow or page keys) moves to the next scene,
 * which slides in over the previous one (from the right, then the top, then the left; mirrored in
 * Arabic) while its clip pushes in and the scene underneath drifts away and dims. Only after the last
 * scene does one more gesture release the page and glide down to the landing content. Scrolling back up
 * from the landing content returns to the last scene and steps back through them.
 *
 * Scene 0 carries the headline and calls to action; the other scenes carry the large chapter title.
 * Reduced motion: no lock (the hero is an ordinary first screen), scenes cross-fade from the chapter
 * rail, no autoplay until the play button is pressed.
 */

import { SWIPE_MIN, WHEEL_MIN, entryFor, hiddenClip, nextStep } from "@/lib/hero-film";

type Chapter = { slug: CategorySlug; name: string; caption: string; image: string };

const EASE = [0.77, 0, 0.18, 1] as const;
/** One scene change takes this long; the next gesture is ignored until it has finished. */
const STEP_MS = 1300;

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
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const shownRef = useRef(0);
  const chapterRef = useRef(0);
  const busyUntil = useRef(0);

  const [chapter, setChapter] = useState(0);
  const [manual, setManual] = useState<"play" | "pause" | null>(null);
  const [inView, setInView] = useState(true);
  const rtl = locale === "ar";
  const intro = chapter === 0;

  const fill = useMotionValue(0);

  const go = useCallback((c: number) => {
    chapterRef.current = c;
    busyUntil.current = performance.now() + STEP_MS;
    setChapter(c);
  }, []);

  // The lock: while the page is at its very top, wheel, swipe and keys move through the scenes.
  useEffect(() => {
    if (reduce) return;
    const count = heroScenes.length;
    const atTop = () => window.scrollY < 2;
    const overlayOpen = () => !!document.querySelector('[aria-modal="true"], dialog[open]');

    /** Applies one gesture. Returns true when the gesture belongs to the hero (and must not scroll the page). */
    const apply = (direction: 1 | -1) => {
      if (performance.now() < busyUntil.current) return true;
      const step = nextStep(chapterRef.current, direction, count);
      if (step.kind === "scene") go(step.to);
      else if (step.kind === "release") {
        busyUntil.current = performance.now() + STEP_MS;
        const end = sectionRef.current?.offsetHeight ?? window.innerHeight;
        window.scrollTo({ top: end, behavior: "smooth" });
      } else return false;
      return true;
    };

    // One wheel gesture is a stream of events; it owns the hero only if it began at the top.
    let lastWheel = 0;
    let owned = false;
    let consumed = false;
    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      if (now - lastWheel > 180) {
        owned = atTop() && !overlayOpen();
        consumed = false;
      }
      lastWheel = now;
      if (!owned || Math.abs(e.deltaY) < WHEEL_MIN) return;
      e.preventDefault();
      if (consumed) return;
      consumed = true;
      apply(e.deltaY > 0 ? 1 : -1);
    };

    let touchY = 0;
    let touchOwned = false;
    let touchDone = false;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY;
      touchOwned = atTop() && !overlayOpen();
      touchDone = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!touchOwned) return;
      const dy = touchY - e.touches[0].clientY;
      if (e.cancelable) e.preventDefault();
      if (touchDone || Math.abs(dy) < SWIPE_MIN) return;
      touchDone = true;
      apply(dy > 0 ? 1 : -1);
    };

    const onKey = (e: KeyboardEvent) => {
      if (!atTop() || overlayOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const space = e.key === " ";
      if (space && t && t !== document.body) return;
      const down = e.key === "ArrowDown" || e.key === "PageDown" || (space && !e.shiftKey);
      const up = e.key === "ArrowUp" || e.key === "PageUp" || (space && e.shiftKey);
      if (!down && !up) return;
      if (apply(down ? 1 : -1)) e.preventDefault();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [reduce, go]);

  // Pause everything while the hero is off screen.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const playing = inView && (manual ? manual === "play" : !reduce);

  // Only the scene on screen plays (from its start); the others stop once the transition has covered them.
  useEffect(() => {
    const timers: number[] = [];
    const fresh = shownRef.current !== chapter;
    shownRef.current = chapter;
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (!playing) {
        v.pause();
      } else if (i === chapter) {
        if (fresh) v.currentTime = 0;
        v.play().catch(() => setManual("pause"));
      } else {
        timers.push(window.setTimeout(() => v.pause(), 1500));
      }
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [chapter, playing]);

  // Ten checks a second keep the chapter progress bar in step with the clip on screen.
  useEffect(() => {
    const read = () => {
      const v = videos.current[chapter];
      return v ? Math.min(1, v.currentTime / (v.duration || 8)) : 0;
    };
    if (!playing) {
      fill.set(read());
      return;
    }
    const timer = window.setInterval(() => fill.set(read()), 100);
    return () => window.clearInterval(timer);
  }, [playing, chapter, fill]);

  function togglePlay() {
    setManual(playing ? "pause" : "play");
  }

  const active = chapters[chapter];

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hero-title"
      className="relative h-dvh"
    >
      <div className="relative h-dvh overflow-hidden">
        {/* Film frame */}
        <motion.div
          className="absolute inset-0 overflow-hidden bg-[#e8d3cb]"
          initial={reduce ? false : { clipPath: "inset(14px round 28px)" }}
          animate={{ clipPath: "inset(0px round 0px)" }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="absolute inset-0"
            initial={reduce ? false : { scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {heroScenes.map((scene, i) => (
              <SceneLayer
                key={scene.key}
                scene={scene}
                index={i}
                chapter={chapter}
                rtl={rtl}
                reduce={reduce}
                videoRef={(el) => {
                  videos.current[i] = el;
                }}
              />
            ))}
          </motion.div>

          {/* Scrims: one under the copy side, one under the chapter rail, one global that deepens on scroll. */}
          <div className="pointer-events-none absolute inset-0 z-10 bg-linear-to-r from-[rgb(var(--scrim)/0.46)] via-[rgb(var(--scrim)/0.12)] to-transparent rtl:bg-linear-to-l md:via-[rgb(var(--scrim)/0.08)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/3 bg-linear-to-t from-[rgb(var(--scrim)/0.42)] to-transparent" />
          <motion.div
            className="pointer-events-none absolute inset-0 z-10 bg-[rgb(var(--scrim))]"
            initial={false}
            animate={{ opacity: !reduce && !intro ? 0.14 : 0 }}
            transition={{ duration: 0.9 }}
          />
        </motion.div>

        {/* Copy */}
        <div className="relative z-10 mx-auto flex h-full max-w-[1480px] flex-col px-5 pb-6 pt-28 text-on-media sm:px-8 md:pb-8 lg:px-14 lg:pt-32">
          <motion.div
            initial={false}
            animate={reduce || intro ? { y: 0, opacity: 1 } : { y: -70, opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-[44rem] [text-shadow:0_1px_2px_rgb(22_10_16/0.35),0_2px_30px_rgb(22_10_16/0.45)]"
            style={{ pointerEvents: reduce || intro ? undefined : "none" }}
            inert={!reduce && !intro}
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
              <HeadlineLine delay={0.1} reduce={reduce}>
                {copy.titleLines[0]} {copy.titleLines[1]}
              </HeadlineLine>
              <HeadlineLine delay={0.25} reduce={reduce} className="italic text-on-media-accent rtl:not-italic">
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

          {/* Chapter title that takes over from the headline once the first scene has gone */}
          {!reduce && !intro && (
            <motion.div
              key={active.slug}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
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
                      onClick={() => go(i)}
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
              aria-label={playing ? copy.pause : copy.play}
              aria-pressed={playing}
              className="grid size-12 shrink-0 place-items-center rounded-full border border-on-media/35 bg-on-media/10 text-on-media backdrop-blur-md transition-[background-color,transform] duration-300 hover:bg-on-media/25 active:scale-95"
            >
              {playing ? <Pause className="size-4" strokeWidth={1.75} /> : <Play className="size-4 translate-x-px" strokeWidth={1.75} />}
            </button>
          </div>
        </div>

        {/* Floating detail card (Glowence reference): close-up of the current chapter. */}
        <motion.aside
          initial={false}
          animate={{ opacity: reduce || intro ? 1 : 0 }}
          transition={{ duration: 0.6 }}
          style={{ visibility: reduce || intro ? "visible" : "hidden" }}
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
                  i === chapter ? "scale-[1.5] opacity-100" : "scale-[1.7] opacity-0",
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
  coiffeuses: "62% 45%",
  esthetique: "50% 45%",
  nails: "50% 50%",
  massage: "62% 60%",
};

/**
 * One scene. Scene 0 is the base. Every other scene is hidden by a clip shrunk toward the side it enters
 * from; showing it opens the clip while the picture inside drifts and settles (a push-in). A scene that
 * a later one now covers drifts away from that scene and dims, which gives the stack its depth.
 */
function SceneLayer({
  scene,
  index,
  chapter,
  rtl,
  reduce,
  videoRef,
}: {
  scene: HeroScene;
  index: number;
  chapter: number;
  rtl: boolean;
  reduce: boolean;
  videoRef: (el: HTMLVideoElement | null) => void;
}) {
  const entry = entryFor(index, rtl);
  const shown = index <= chapter;
  const covered = index < chapter;
  const above = entryFor(index + 1, rtl);
  const open = "inset(0% 0% 0% 0%)";

  const transition = { duration: reduce ? 0.6 : 1.25, ease: EASE, delay: shown ? 0 : reduce ? 0 : (heroScenes.length - 1 - index) * 0.08 };

  let x = 0;
  let y = 0;
  let scale = 1;
  if (!reduce && index > 0 && !shown) {
    x = -entry.x * 12;
    y = -entry.y * 12;
    scale = 1.16;
  } else if (!reduce && covered) {
    x = -above.x * 7;
    y = -above.y * 7;
    scale = 1.05;
  }

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      style={{ zIndex: index }}
      initial={false}
      animate={reduce ? { opacity: shown ? 1 : 0 } : { clipPath: index === 0 || shown ? open : hiddenClip(entry) }}
      transition={transition}
    >
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{ x: `${x}%`, y: `${y}%`, scale }}
        transition={transition}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: scene.position }}
          poster={scene.poster}
          muted
          loop
          playsInline
          preload={index <= chapter + 1 ? "auto" : "none"}
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src={`/media/hero-${scene.key}-960.mp4`} type="video/mp4" media="(max-width: 900px)" />
          <source src={`/media/hero-${scene.key}.mp4`} type="video/mp4" />
        </video>
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-0 bg-[rgb(var(--scrim))]"
        initial={false}
        animate={{ opacity: !reduce && covered ? 0.38 : 0 }}
        transition={transition}
      />
    </motion.div>
  );
}

function HeadlineLine({
  children,
  delay,
  reduce,
  className,
}: {
  children: React.ReactNode;
  delay: number;
  reduce: boolean;
  className?: string;
}) {
  return (
    <span className={cn("block pb-1", className)}>
      <motion.span
        className="block"
        initial={reduce ? false : { opacity: 0, y: "0.35em", filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.span>
    </span>
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
