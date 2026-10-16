"use client";

import type { ReactNode } from "react";
import { useFindCareOptional } from "./find-care";

/** Any element that opens the shared "Trouver mon soin" search. */
export function SearchChip({ className, children, label }: { className?: string; children: ReactNode; label?: string }) {
  const findCare = useFindCareOptional();
  return (
    <button type="button" onClick={() => findCare?.open()} className={className} aria-label={label}>
      {children}
    </button>
  );
}
