import { notFound } from "next/navigation";
import { categoryArt, categorySlugs, heroFilmChapters, type CategorySlug } from "@/config/categories";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AccountSlot } from "@/components/layout/account-slot";
import { FindCareProvider } from "@/components/marketing/find-care";
import { HeroFilm } from "@/components/marketing/hero-film";
import { HomeIntro } from "@/components/marketing/home-intro";
import { WhyUs } from "@/components/marketing/why-us";
import { CategoryBento } from "@/components/marketing/category-bento";
import { Spotlight } from "@/components/marketing/spotlight";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { FeaturedProfessionals } from "@/components/marketing/featured-professionals";
import { Faq } from "@/components/marketing/faq";
import { ProCta } from "@/components/marketing/pro-cta";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  const categoryNames = Object.fromEntries(categorySlugs.map((s) => [s, dict.categories[s].name])) as Record<
    CategorySlug,
    string
  >;
  const chapters = heroFilmChapters.map((slug) => ({
    slug,
    name: dict.categories[slug].name,
    caption: dict.categories[slug].caption,
    image: categoryArt[slug].image,
  }));

  return (
    <FindCareProvider locale={locale} copy={dict.search} categoryNames={categoryNames}>
      <SiteHeader
        locale={locale}
        nav={dict.nav}
        findLabel={dict.hero.primary}
        brand={dict.brand.name}
        categoryNames={categoryNames}
        categories={dict.categories}
        overMedia
        account={<AccountSlot locale={locale} signInLabel={dict.nav.signIn} variant="header" />}
      />
      <main id="main">
        <HeroFilm locale={locale} copy={dict.hero} chapters={chapters} />
        <HomeIntro locale={locale} copy={dict.home.intro} categories={dict.categories} />
        <WhyUs copy={dict.home.why} />
        <CategoryBento locale={locale} copy={dict.home.bento} categories={dict.categories} verifiedOnly={dict.showcase.verifiedOnly} />
        <Spotlight locale={locale} copy={dict.home.spotlight} category={dict.categories.nails} />
        <FeaturedProfessionals locale={locale} copy={dict.featured} categories={dict.categories} />
        <HowItWorks copy={dict.how} />
        <Faq copy={dict.faq} />
        <ProCta locale={locale} copy={dict.proCta} />
      </main>
      <SiteFooter locale={locale} dict={dict} categoryNames={categoryNames} />
    </FindCareProvider>
  );
}
