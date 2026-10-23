"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

/**
 * The site's own confirmation step (instead of the browser's grey window): a card over a dimmed page,
 * with Annuler and the action. Built on <dialog>, so focus stays inside, Escape cancels and the page
 * behind cannot be clicked.
 */
export function ConfirmDialog({
  open,
  message,
  confirmLabel,
  cancelLabel,
  pending,
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  tone?: "danger" | "solid";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] motion-safe:open:animate-[dialog-in_200ms_ease-out] motion-safe:backdrop:animate-[backdrop-in_200ms_ease-out] rounded-3xl border border-border bg-card p-0 text-card-foreground shadow-[0_30px_80px_-24px_rgb(0_0_0/0.8)] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="grid gap-5 p-6">
        <div className="flex items-start gap-3">
          {tone === "danger" && (
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
              <AlertTriangle className="size-4" strokeWidth={2} aria-hidden="true" />
            </span>
          )}
          <p className="pt-1.5 text-[0.95rem] leading-relaxed">{message}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className={buttonClass({ variant: "ghost", size: "sm", className: "border border-border" })}>
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            disabled={pending}
            onClick={onConfirm}
            className={
              tone === "danger"
                ? buttonClass({ variant: "ghost", size: "sm", className: "bg-destructive font-medium text-white hover:bg-destructive/85 hover:text-white" })
                : buttonClass({ variant: "solid", size: "sm" })
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
