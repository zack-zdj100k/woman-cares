"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

/** Uploads or removes the profile picture (cropped to a square on the server). */
export function AvatarForm({ url, initials, labels }: { url: string | null; initials: string; labels: { change: string; remove: string; hint: string; errors: Record<string, string> } }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: "POST" | "DELETE", file?: File) {
    setBusy(true);
    setError(null);
    const body = file ? new FormData() : undefined;
    if (file && body) body.append("file", file);
    const res = await fetch("/api/v1/me/avatar", { method, body });
    setBusy(false);
    if (!res.ok) {
      const code = ((await res.json().catch(() => null)) as { error?: { code?: string } } | null)?.error?.code ?? "GENERIC";
      setError(labels.errors[code] ?? labels.errors.GENERIC);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-xl font-semibold">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="" className="size-full object-cover" /> : initials}
      </span>
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className={buttonClass({ variant: "outline", size: "sm" })}>
            <Camera className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {labels.change}
          </button>
          {url && (
            <button type="button" disabled={busy} onClick={() => send("DELETE")} className={buttonClass({ variant: "ghost", size: "sm" })}>
              {labels.remove}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{labels.hint}</p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void send("POST", f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
