"use client";

import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Horizontal snap gallery with round previous/next buttons (owner's picture 7, "discover"). */
export function SnapGallery({ children, previous, next, rtl }: { children: ReactNode; previous: string; next: string; rtl: boolean }) {
  const ref = useRef<HTMLUListElement>(null);
  const go = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * (rtl ? -1 : 1) * ref.current.clientWidth * 0.7, behavior: "smooth" });
  const btn = "grid size-11 place-items-center rounded-full bg-white/90 shadow-[inset_0_1px_0_white,0_8px_18px_-10px_rgb(74_32_46/0.5)] transition-transform hover:-translate-y-px";
  return (
    <div>
      <ul ref={ref} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none]">
        {children}
      </ul>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={() => go(-1)} aria-label={previous} className={btn}>
          <ChevronLeft className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
        </button>
        <button type="button" onClick={() => go(1)} aria-label={next} className={btn}>
          <ChevronRight className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
