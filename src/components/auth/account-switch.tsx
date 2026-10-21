"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Labels = { signIn: string; create: string; choose: string; client: string; provider: string };

/** Top of the sign-in page: enter an existing account, or create one as a client or a professional. */
export function AccountSwitch({ locale, labels }: { locale: string; labels: Labels }) {
  const [open, setOpen] = useState(false);
  const pill = "rounded-full px-5 py-2.5 text-sm font-medium transition-colors";
  return (
    <div className="grid gap-3">
      <div className="inline-flex w-fit rounded-full border border-line p-1">
        <span aria-current="page" className={cn(pill, "bg-ink text-ground")}>
          {labels.signIn}
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="create-account-choices"
          onClick={() => setOpen((v) => !v)}
          className={cn(pill, open ? "bg-ink/10 text-ink" : "text-ink-2 hover:text-ink")}
        >
          {labels.create}
        </button>
      </div>
      <div id="create-account-choices" hidden={!open} className="grid gap-2">
        <p className="text-sm text-ink-2">{labels.choose}</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${locale}/auth/sign-up`} className="rounded-full border border-line bg-white/80 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-white">
            {labels.client}
          </Link>
          <Link href={`/${locale}/auth/sign-up?role=provider`} className="rounded-full border border-line bg-white/80 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-white">
            {labels.provider}
          </Link>
        </div>
      </div>
    </div>
  );
}
