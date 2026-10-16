/** Shared input styling. Lives outside "use client" modules so server components get the string, not a client reference. */
export const fieldClass =
  "h-12 w-full rounded-(--radius-field) border bg-ground px-4 text-[0.95rem] text-ink transition-colors placeholder:text-ink-2/70 focus:border-rose focus:outline-none";
