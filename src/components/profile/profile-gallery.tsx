"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { cn } from "@/lib/cn";

type Media = { id: string; type: "IMAGE" | "VIDEO"; url: string; alt: string | null };

/** Large stage + thumbnails. Videos play with native controls (never autoplay with sound). */
export function ProfileGallery({ media, name, emptyLabel }: { media: Media[]; name: string; emptyLabel: string }) {
  const [index, setIndex] = useState(0);
  const current = media[index];

  if (!current) {
    return (
      <div className="grid aspect-[4/5] place-items-center rounded-(--radius-media) bg-surface-2 p-8 text-center text-ink-2 md:aspect-[5/4]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-(--radius-media) bg-surface-2 md:aspect-[5/4]">
        {current.type === "VIDEO" ? (
          <video key={current.id} src={current.url} controls playsInline preload="metadata" className="size-full object-cover" />
        ) : (
          <Image
            key={current.id}
            src={current.url}
            alt={current.alt ?? name}
            fill
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : "auto"}
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover"
          />
        )}
      </div>
      {media.length > 1 && (
        <ul className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
          {media.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${i + 1} / ${media.length}`}
                aria-pressed={i === index}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-xl bg-surface-2 transition-[opacity,outline] duration-300",
                  i === index ? "outline-2 outline-offset-2 outline-rose" : "opacity-70 hover:opacity-100",
                )}
              >
                {m.type === "VIDEO" ? (
                  <span className="grid size-full place-items-center bg-wine text-on-wine">
                    <Play className="size-4" strokeWidth={1.75} />
                  </span>
                ) : (
                  <Image src={m.url} alt="" fill sizes="96px" className="object-cover" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
