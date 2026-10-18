"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

/** Side drawer (the dashboard sidebar on phones). `side` is logical: start/end follow the text direction. */
export function SheetContent({
  side = "start",
  className,
  children,
  closeLabel,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: "start" | "end"; closeLabel: string }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=closed]:animate-[fade-out_0.2s] data-[state=open]:animate-[fade-in_0.2s]" />
      <SheetPrimitive.Content
        className={cn(
          // The portal renders outside the dashboard's dark scope: carry the scope so the tokens resolve.
          "dashboard-dark fixed inset-y-0 z-50 flex min-h-0 w-[18rem] max-w-[85vw] flex-col overflow-y-auto bg-sidebar text-sidebar-foreground shadow-2xl outline-none",
          side === "start" ? "start-0 border-e border-sidebar-border" : "end-0 border-s border-sidebar-border",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute end-3 top-3 grid size-9 place-items-center rounded-full text-sidebar-foreground/70 hover:bg-white/8 hover:text-white">
          <X className="size-4" strokeWidth={1.75} />
          <span className="sr-only">{closeLabel}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
