"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import type { ProviderDictionary } from "@/i18n/dictionaries/provider.fr";
import { Field, TextInput, fieldClass } from "@/components/auth/fields";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Copy = ProviderDictionary["credentials"];

/** Sends a qualification document to private storage for staff review. */
export function CredentialUpload({ categories, copy }: { categories: { slug: string; label: string }[]; copy: Copy }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const body = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/v1/provider/credentials", { method: "POST", body });
      if (!res.ok) {
        const code = (await res.json().catch(() => null))?.error?.code ?? "GENERIC";
        setError(copy.errors[code] ?? copy.errors.GENERIC);
        setState("idle");
        return;
      }
      formRef.current?.reset();
      setState("sent");
      startTransition(() => router.refresh());
    } catch {
      setError(copy.errors.GENERIC);
      setState("idle");
    }
  }

  if (categories.length === 0) return null;
  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={copy.category}>
          {({ id }) => (
            <select id={id} name="category" required className={cn(fieldClass, "border-ink/15")}>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={copy.type}>
          {({ id }) => (
            <select id={id} name="type" required className={cn(fieldClass, "border-ink/15")}>
              {Object.entries(copy.types).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={copy.issuer}>{({ id }) => <TextInput id={id} name="issuer" maxLength={160} />}</Field>
        <Field label={copy.expiresAt}>{({ id }) => <TextInput id={id} name="expiresAt" type="date" />}</Field>
      </div>
      <Field label={copy.file}>
        {({ id }) => (
          <input
            id={id}
            name="file"
            type="file"
            required
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="block w-full text-sm file:me-4 file:rounded-full file:border file:border-ink/15 file:bg-ground file:px-4 file:py-2 file:text-sm file:text-ink"
          />
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={state === "sending"} className={buttonClass({ variant: "outline" })}>
          <FileUp className="size-4" strokeWidth={1.75} />
          {state === "sending" ? copy.sending : copy.submit}
        </button>
        {state === "sent" && <p role="status" className="text-sm">{copy.sent}</p>}
        {error && <p role="alert" className="text-sm text-rose-ink">{error}</p>}
      </div>
    </form>
  );
}
