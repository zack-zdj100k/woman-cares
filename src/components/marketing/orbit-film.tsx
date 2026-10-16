"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useReducedMotion } from "motion/react";

/** Round film with four labels on its orbit (owner's picture 7, hero badge). */
export function OrbitFilm({ labels, play, pause }: { labels: string[]; play: string; pause: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v || reduce) return;
    v.play().catch(() => {});
  }, [reduce]);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const pos = ["top-0 left-1/2 -translate-x-1/2 -translate-y-[130%]", "top-1/2 end-0 translate-x-[calc(100%+0.9rem)] -translate-y-1/2 rtl:-translate-x-[calc(100%+0.9rem)]", "bottom-0 left-1/2 -translate-x-1/2 translate-y-[130%]", "top-1/2 start-0 -translate-x-[calc(100%+0.9rem)] -translate-y-1/2 rtl:translate-x-[calc(100%+0.9rem)]"];

  return (
    <div className="relative mx-auto aspect-square w-[min(15rem,52vw)]">
      <span aria-hidden="true" className="absolute -inset-5 rounded-full border border-white/35" />
      {labels.slice(0, 4).map((l, i) => (
        <span key={l} className={`absolute whitespace-nowrap text-sm text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.5)] ${pos[i]}`}>
          <span aria-hidden="true" className="me-1.5 inline-block size-1.5 rounded-full bg-white align-middle" />
          {l}
        </span>
      ))}
      <div className="absolute inset-0 overflow-hidden rounded-full border border-white/50 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)]">
        <video
          ref={ref}
          className="size-full object-cover"
          src={reduce ? undefined : "/media/pro-cta-nails.mp4"}
          poster="/images/hero/pro-cta-nails.jpg"
          muted
          loop
          playsInline
          aria-hidden="true"
          tabIndex={-1}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
        />
      </div>
      {!reduce && (
        <button
          type="button"
          onClick={toggle}
          aria-label={paused ? play : pause}
          className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/60 bg-white/25 text-white backdrop-blur-md transition-transform hover:scale-105"
        >
          {paused ? <Play className="size-5 fill-current" strokeWidth={1.5} /> : <Pause className="size-5" strokeWidth={1.75} />}
        </button>
      )}
    </div>
  );
}
