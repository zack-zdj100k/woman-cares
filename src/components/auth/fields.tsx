"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

export const fieldClass =
  "h-12 w-full rounded-(--radius-field) border bg-ground px-4 text-[0.95rem] text-ink transition-colors placeholder:text-ink-2/70 focus:border-rose focus:outline-none";

export function Field({
  label,
  error,
  hint,
  children,
  id,
}: {
  label: ReactNode;
  error?: string;
  hint?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  id?: string;
}) {
  const auto = useId();
  const fieldId = id ?? auto;
  const describedBy = [error ? `${fieldId}-err` : null, hint ? `${fieldId}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid content-start gap-2">
      <label htmlFor={fieldId} className="text-sm font-medium">
        {label}
      </label>
      {children({ id: fieldId, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={`${fieldId}-hint`} className="text-sm text-ink-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-err`} className="text-sm text-rose-ink">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({
  invalid,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={cn(fieldClass, invalid ? "border-rose" : "border-ink/15", className)} {...props} />;
}

export function PasswordInput({
  invalid,
  showLabel,
  hideLabel,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; showLabel: string; hideLabel: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        type={shown ? "text" : "password"}
        aria-invalid={invalid || undefined}
        className={cn(fieldClass, "pe-12", invalid ? "border-rose" : "border-ink/15")}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? hideLabel : showLabel}
        aria-pressed={shown}
        className="absolute inset-y-0 end-0 grid w-12 place-items-center text-ink-2 hover:text-ink"
      >
        {shown ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
      </button>
    </div>
  );
}

export function FormAlert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cn("rounded-(--radius-field) p-4 text-sm leading-relaxed", tone === "error" ? "bg-surface text-rose-ink" : "bg-parchment text-ink")}>
      {children}
    </p>
  );
}
