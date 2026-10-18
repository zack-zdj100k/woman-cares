"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";

/** Her own specialties as chips: type one, add it, remove it. Sent as one comma-separated field. */
export function SpecialtyCreator({ initial, labels }: { initial: string[]; labels: { placeholder: string; add: string; remove: string; max: string } }) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState("");
  const full = items.length >= 8;
  const add = () => {
    const v = draft.trim().replace(/\s+/g, " ").replace(/,/g, " ");
    if (v.length < 2 || v.length > 40 || full || items.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    setItems((all) => [...all, v]);
    setDraft("");
  };
  return (
    <div className="grid gap-3">
      <input type="hidden" name="customSpecialties" value={items.join(", ")} />
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((s) => (
            <li key={s} className="inline-flex items-center gap-1.5 rounded-full border border-rose bg-surface py-1.5 ps-4 pe-1.5 text-sm">
              {s}
              <button type="button" onClick={() => setItems((all) => all.filter((x) => x !== s))} aria-label={`${labels.remove} ${s}`} className="grid size-6 place-items-center rounded-full hover:bg-ink/10">
                <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          maxLength={40}
          disabled={full}
          placeholder={full ? labels.max : labels.placeholder}
          className="h-11 min-w-0 flex-1 rounded-(--radius-field) border border-ink/15 bg-ground px-4 text-[0.95rem] focus:border-rose focus:outline-none disabled:opacity-60"
        />
        <button type="button" onClick={add} disabled={full || draft.trim().length < 2} className={cn("inline-flex h-11 items-center gap-1.5 rounded-full border border-ink/20 px-4 text-sm hover:bg-surface disabled:opacity-50")}>
          <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
          {labels.add}
        </button>
      </div>
    </div>
  );
}
