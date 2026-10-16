"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Types a caption out character by character (the "live caption" moment from
 * the hero reference). Screen readers get the full sentence at once.
 */
export function Typewriter({ text, cps = 38, className }: { text: string; cps?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) window.clearInterval(id);
    }, 1000 / cps);
    return () => {
      window.clearInterval(id);
      setCount(0);
    };
  }, [text, cps, reduce]);

  const shown = reduce ? text : text.slice(0, count);
  const typing = !reduce && count < text.length;

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {shown}
        <span
          className={typing ? "ms-0.5 inline-block h-[1em] w-px translate-y-[0.15em] bg-current opacity-70" : "hidden"}
        />
      </span>
    </span>
  );
}
