import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { AdminDictionary } from "@/i18n/dictionaries/admin.fr";
import { cn } from "@/lib/cn";

export function AdminNav({ locale, active, copy }: { locale: Locale; active: "overview" | "providers"; copy: AdminDictionary["nav"] }) {
  const items = [
    { key: "overview", href: `/${locale}/dashboard/admin`, label: copy.overview },
    { key: "providers", href: `/${locale}/dashboard/admin/providers`, label: copy.providers },
  ] as const;
  return (
    <nav aria-label={copy.label} className="mb-10 -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <ul className="inline-flex gap-1 rounded-full border border-line p-1">
        {items.map((i) => (
          <li key={i.key}>
            <Link
              href={i.href}
              aria-current={i.key === active ? "page" : undefined}
              className={cn("block whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium transition-colors", i.key === active ? "bg-ink text-ground" : "text-ink-2 hover:text-ink")}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
