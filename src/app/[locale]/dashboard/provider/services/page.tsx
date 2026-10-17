import type { Metadata } from "next";
import Link from "next/link";
import type { CategorySlug } from "@/config/categories";
import type { Locale } from "@/i18n/config";
import { getDictionary, getProviderDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { listMyProfiles } from "@/server/services/provider-profiles";
import { buttonClass } from "@/components/ui/button";
import { pageClass } from "@/components/dashboard/shell/dashboard-shell";

export async function generateMetadata(): Promise<Metadata> {
  const pt = await getProviderDictionary(await getLocale());
  return { title: pt.index.servicesTitle, robots: { index: false } };
}

/** Each category profile has its own services; this page points to the right editor section. */
export default async function Page() {
  const locale = await getLocale();
  return (
    <>
      <Index locale={locale} />
    </>
  );
}

async function Index({ locale }: { locale: Locale }) {
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider/services`);
  const [dict, pt, profiles] = await Promise.all([getDictionary(locale), getProviderDictionary(locale), listMyProfiles(user)]);
  return (
    <div className={pageClass}>
      <h1 className="type-display text-[clamp(2.6rem,5vw,4rem)]">{pt.index.servicesTitle}</h1>
      <p className="mt-4 max-w-[44rem] text-lg text-ink-2">{pt.index.servicesIntro}</p>
      <ul className="mt-10 grid gap-3">
        {profiles
          .filter((p) => p.status !== "ARCHIVED")
          .map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 rounded-(--radius-field) border border-line p-5">
              <span className="type-display text-2xl">{dict.categories[p.category.slug as CategorySlug]?.name}</span>
              <Link href={`/${locale}/dashboard/provider/profiles/${p.id}#services`} className={buttonClass({ variant: "outline", size: "sm" })}>
                {pt.index.open}
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}
