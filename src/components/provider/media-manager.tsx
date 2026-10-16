"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2, Video } from "lucide-react";
import type { ProviderDictionary } from "@/i18n/dictionaries/provider.fr";
import { mediaAction } from "@/app/[locale]/dashboard/provider/actions";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type MediaRow = { id: string; type: "IMAGE" | "VIDEO"; url: string; alt: string | null; isCardImage: boolean };
type Copy = ProviderDictionary["editor"]["portfolio"];

/**
 * Uploads go to the media Route Handler one file at a time (the server detects the real type,
 * re-encodes images and strips metadata); ordering and deletion use Server Actions.
 */
export function MediaManager({ profileId, media, copy, disabled }: { profileId: string; media: MediaRow[]; copy: Copy; disabled: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  async function upload(files: FileList) {
    const list = Array.from(files);
    setErrors([]);
    setProgress({ done: 0, total: list.length });
    const failed: string[] = [];
    for (const [i, file] of list.entries()) {
      const body = new FormData();
      body.append("file", file);
      try {
        const res = await fetch(`/api/v1/provider/profiles/${profileId}/media`, { method: "POST", body });
        if (!res.ok) {
          const code = (await res.json().catch(() => null))?.error?.code ?? "GENERIC";
          failed.push(`${file.name}: ${copy.errors[code] ?? copy.errors.GENERIC}`);
        }
      } catch {
        failed.push(`${file.name}: ${copy.errors.GENERIC}`);
      }
      setProgress({ done: i + 1, total: list.length });
    }
    setProgress(null);
    setErrors(failed);
    if (input.current) input.current.value = "";
    startTransition(() => router.refresh());
  }

  const iconButton = "grid size-9 place-items-center rounded-full border border-ink/15 bg-ground text-ink transition-colors hover:bg-surface disabled:opacity-40";

  return (
    <div className="grid gap-6">
      <p className="text-ink-2">{copy.intro}</p>
      {!disabled && (
        <div className="grid gap-2">
          <label className={buttonClass({ variant: "outline", className: "cursor-pointer justify-self-start" })}>
            <ImagePlus className="size-4" strokeWidth={1.75} />
            {progress ? copy.uploading.replace("{done}", String(progress.done)).replace("{total}", String(progress.total)) : copy.upload}
            <input
              ref={input}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              className="sr-only"
              disabled={Boolean(progress)}
              onChange={(e) => e.target.files?.length && upload(e.target.files)}
            />
          </label>
          <p className="text-sm text-ink-2">{copy.formats}</p>
          {errors.length > 0 && (
            <ul role="alert" className="grid gap-1 text-sm text-rose-ink">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {media.length === 0 ? (
        <p className="rounded-(--radius-field) bg-surface p-5 text-ink-2">{copy.empty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {media.map((m, i) => (
            <li key={m.id} className={cn("overflow-hidden rounded-(--radius-field) border", m.isCardImage ? "border-rose" : "border-line")}>
              <div className="relative aspect-square bg-surface-2">
                {m.type === "IMAGE" ? (
                  <Image src={m.url} alt={m.alt ?? ""} fill sizes="(min-width: 640px) 30vw, 45vw" className="object-cover" />
                ) : (
                  <span className="grid size-full place-items-center gap-2 text-sm text-ink-2">
                    <Video className="size-6" strokeWidth={1.5} />
                    {copy.video}
                  </span>
                )}
                {m.isCardImage && (
                  <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-rose px-2.5 py-1 text-xs text-on-rose">
                    <Star className="size-3" strokeWidth={2} />
                    {copy.card}
                  </span>
                )}
              </div>
              <div className="grid gap-3 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <form action={mediaAction}>
                    <input type="hidden" name="mediaId" value={m.id} />
                    <input type="hidden" name="op" value="up" />
                    <button type="submit" disabled={disabled || i === 0} aria-label={copy.up} className={iconButton}>
                      <ArrowUp className="size-4 rtl:rotate-0" strokeWidth={1.75} />
                    </button>
                  </form>
                  <form action={mediaAction}>
                    <input type="hidden" name="mediaId" value={m.id} />
                    <input type="hidden" name="op" value="down" />
                    <button type="submit" disabled={disabled || i === media.length - 1} aria-label={copy.down} className={iconButton}>
                      <ArrowDown className="size-4" strokeWidth={1.75} />
                    </button>
                  </form>
                  {m.type === "IMAGE" && !m.isCardImage && (
                    <form action={mediaAction}>
                      <input type="hidden" name="mediaId" value={m.id} />
                      <input type="hidden" name="op" value="card" />
                      <button type="submit" disabled={disabled} aria-label={copy.setCard} title={copy.setCard} className={iconButton}>
                        <Star className="size-4" strokeWidth={1.75} />
                      </button>
                    </form>
                  )}
                  <form action={mediaAction} className="ms-auto">
                    <input type="hidden" name="mediaId" value={m.id} />
                    <input type="hidden" name="op" value="delete" />
                    <button type="submit" disabled={disabled} aria-label={copy.delete} className={cn(iconButton, "text-rose-ink")}>
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    </button>
                  </form>
                </div>
                {m.type === "IMAGE" && (
                  <form action={mediaAction} className="flex gap-2">
                    <input type="hidden" name="mediaId" value={m.id} />
                    <input type="hidden" name="op" value="alt" />
                    <input
                      name="alt"
                      defaultValue={m.alt ?? ""}
                      maxLength={200}
                      aria-label={copy.alt}
                      placeholder={copy.alt}
                      disabled={disabled}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-ink/15 bg-ground px-2.5 text-sm placeholder:text-ink-2/70 focus:border-rose focus:outline-none"
                    />
                    <button type="submit" disabled={disabled} className="text-xs underline underline-offset-4">
                      {copy.saveAlt}
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
