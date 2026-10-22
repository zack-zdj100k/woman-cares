"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** A value people have to type elsewhere (an account number): shown in full, copied with one tap. */
export function CopyValue({ value, copyLabel, copiedLabel }: { value: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? <Check className="size-3.5" strokeWidth={1.75} aria-hidden="true" /> : <Copy className="size-3.5" strokeWidth={1.75} aria-hidden="true" />}
      <span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
    </button>
  );
}
