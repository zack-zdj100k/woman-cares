"use client";

import { useRef, useState, type MouseEvent } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { ArrowUpRight, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Location card (owner's reference component, adapted to Woman Cares): tilts with the pointer and
 * unfolds a drawn street map on hover or focus. One click opens the professional's own Google Maps
 * link in a new tab. The map drawing is decorative; the place shown is the area she chose to publish.
 */
export function LocationMap({ href, location, detail, openLabel, className }: { href: string; location: string; detail?: string; openLabel: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-50, 50], [8, -8]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-50, 50], [-8, 8]), { stiffness: 300, damping: 30 });

  const onMove = (e: MouseEvent) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set(e.clientX - (r.left + r.width / 2));
    y.set(e.clientY - (r.top + r.height / 2));
  };
  const leave = () => {
    x.set(0);
    y.set(0);
    setOpen(false);
  };

  return (
    <motion.a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${openLabel} : ${location}`}
      onMouseMove={onMove}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={leave}
      onFocus={() => setOpen(true)}
      onBlur={leave}
      className={cn("group relative block w-full select-none rounded-[22px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose", className)}
      style={{ perspective: 1000 }}
    >
      <motion.div
        className="relative w-full overflow-hidden rounded-[22px] border border-line bg-white/80"
        style={reduce ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
        animate={{ height: open ? 220 : 128 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 35 }}
      >
        <div className="absolute inset-0 bg-linear-to-br from-surface/40 via-transparent to-surface/70" />

        <AnimatePresence>
          {open && (
            <motion.div className="pointer-events-none absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} aria-hidden="true">
              <div className="absolute inset-0 bg-surface" />
              <svg className="absolute inset-0 size-full" preserveAspectRatio="none">
                {[35, 65].map((v, i) => (
                  <motion.line key={`h${v}`} x1="0%" y1={`${v}%`} x2="100%" y2={`${v}%`} className="stroke-ink/20" strokeWidth="4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }} />
                ))}
                {[30, 70].map((v, i) => (
                  <motion.line key={`v${v}`} x1={`${v}%`} y1="0%" x2={`${v}%`} y2="100%" className="stroke-ink/15" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.4 + i * 0.1 }} />
                ))}
                {[20, 50, 80].map((v, i) => (
                  <motion.line key={`hs${v}`} x1="0%" y1={`${v}%`} x2="100%" y2={`${v}%`} className="stroke-ink/8" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.6 + i * 0.1 }} />
                ))}
                {[15, 45, 55, 85].map((v, i) => (
                  <motion.line key={`vs${v}`} x1={`${v}%`} y1="0%" x2={`${v}%`} y2="100%" className="stroke-ink/8" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.7 + i * 0.1 }} />
                ))}
              </svg>
              {[
                "top-[40%] left-[10%] h-[20%] w-[15%]",
                "top-[15%] left-[35%] h-[15%] w-[12%]",
                "top-[70%] left-[75%] h-[18%] w-[18%]",
                "top-[20%] right-[10%] h-[25%] w-[10%]",
                "top-[8%] left-[75%] h-[10%] w-[14%]",
              ].map((c, i) => (
                <motion.div key={c} className={cn("absolute rounded-sm border border-ink/10 bg-ink/10", c)} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.5 + i * 0.05 }} />
              ))}
              <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" initial={{ scale: 0, y: -20 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.3 }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" style={{ filter: "drop-shadow(0 0 10px rgb(168 68 92 / 0.45))" }}>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="var(--rose)" />
                  <circle cx="12" cy="9" r="2.5" fill="white" />
                </svg>
              </motion.div>
              <div className="absolute inset-0 bg-linear-to-t from-white/80 via-transparent to-transparent" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative z-10 flex h-full flex-col justify-between p-5">
          <div className="flex items-start justify-between">
            <MapIcon className={cn("size-[18px] text-rose transition-opacity", open && "opacity-0")} strokeWidth={2} aria-hidden="true" />
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-[0.7rem] font-medium text-ink-2 backdrop-blur-sm">
              Google Maps
              <ArrowUpRight className="size-3 rtl:-scale-x-100" strokeWidth={2} aria-hidden="true" />
            </span>
          </div>
          <div className="grid gap-1">
            <p className="text-sm font-medium tracking-tight transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1">{location}</p>
            {detail && <p className="text-xs text-ink-2">{detail}</p>}
            <span className={cn("h-px origin-left bg-linear-to-r from-rose/60 via-rose/30 to-transparent transition-transform duration-500 rtl:origin-right", open ? "scale-x-100" : "scale-x-[0.3]")} aria-hidden="true" />
            <span className="text-xs text-rose-ink">{openLabel}</span>
          </div>
        </div>
      </motion.div>
    </motion.a>
  );
}
