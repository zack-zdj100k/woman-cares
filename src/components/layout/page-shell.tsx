import type { ReactNode } from "react";
import { categorySlugs, type CategorySlug } from "@/config/categories";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { FindCareProvider } from "@/components/marketing/find-care";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { AccountSlot } from "./account-slot";

/** Header (solid), footer and the shared search dialog for every page except the homepage. */
export async function PageShell({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const categoryNames = Object.fromEntries(categorySlugs.map((s) => [s, dict.categories[s].name])) as Record<
    CategorySlug,
    string
  >;
  return (
    <FindCareProvider locale={locale} copy={dict.search} categoryNames={categoryNames}>
      <SiteHeader
        locale={locale}
        nav={dict.nav}
        findLabel={dict.hero.primary}
        brand={dict.brand.name}
        categoryNames={categoryNames}
        categories={dict.categories}
        account={<AccountSlot locale={locale} signInLabel={dict.nav.signIn} variant="header" />}
        accountIcon={<AccountSlot locale={locale} signInLabel={dict.nav.signIn} variant="icon" />}
      />
      <main id="main" className="min-h-[70dvh] pt-24">
        {children}
      </main>
      <SiteFooter locale={locale} dict={dict} categoryNames={categoryNames} />
    </FindCareProvider>
  );
}
