"use client";

import { Search } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { useFindCare } from "./find-care";

/** Opens the shared "Trouver mon soin" search dialog from anywhere on the page. */
export function FindCareButton({
  label,
  className,
  variant = "outline",
}: {
  label: string;
  className?: string;
  variant?: "outline" | "solid";
}) {
  const { open } = useFindCare();
  return (
    <button type="button" onClick={() => open()} className={buttonClass({ variant, className })}>
      <Search className="size-4" strokeWidth={1.75} />
      {label}
    </button>
  );
}
