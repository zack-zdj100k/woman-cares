import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin } from "lucide-react";
import { isCategorySlug } from "@/config/categories";
import { isLocale } from "@/i18n/config";
import { getDictionary, getPagesDictionary } from "@/i18n/get-dictionary";
import { formatDzd } from "@/lib/format";
import { getPublicProvider } from "@/server/services/profiles";
import { PageShell } from "@/components/layout/page-shell";

type Params = PageProps<"/[locale]/providers/[slug]">["params"];

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const provider = await getPublicProvider(slug);
  return provider ? { title: provider.businessName, description: provider.bio ?? undefined } : {};
}

export default function ProviderPage({ params }: { params: Params }) {
  return (
    <PageShell>
      <Suspense fallback={<div className="mx-auto h-96 max-w-[1480px] animate-pulse px-5" aria-hidden="true" />}>
        <ProviderContent params={params} />
      </Suspense>
    </PageShell>
  );
}

async function ProviderContent({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const provider = await getPublicProvider(slug);
  if (!provider) notFound();
  const [dict, pages] = await Promise.all([getDictionary(locale), getPagesDictionary(locale)]);
  const place = [locale === "ar" ? provider.communeAr : provider.communeFr, locale === "ar" ? provider.wilayaAr : provider.wilayaFr]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-[1480px] px-5 pt-12 pb-24 sm:px-8 md:pt-16 lg:px-14">
      <header className="max-w-[48rem]">
        <h1 className="type-display text-[clamp(3rem,6vw,5.5rem)]">
          {provider.businessName}
          {provider.verified && <BadgeCheck className="ms-3 inline size-7 align-baseline text-rose" strokeWidth={1.5} aria-label={pages.profile.verified} />}
        </h1>
        <p className="mt-4 flex items-center gap-2 text-ink-2">
          <MapPin className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {place}, {pages.workplace[provider.workplaceType].toLowerCase()}
        </p>
        {provider.bio && <p className="mt-6 whitespace-pre-line text-lg leading-relaxed">{provider.bio}</p>}
      </header>

      <h2 className="type-display mt-16 mb-8 text-[clamp(2rem,3vw,2.75rem)]">{pages.provider.categories}</h2>
      <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {provider.profiles.map((p) =>
          isCategorySlug(p.categorySlug) ? (
            <li key={p.slug}>
              <Link href={`/${locale}/profiles/${p.slug}`} className="group block">
                <div className="relative aspect-[4/3] overflow-hidden rounded-(--radius-media) bg-surface-2">
                  {p.imageUrl && (
                    <Image src={p.imageUrl} alt="" fill sizes="(min-width: 1024px) 30vw, 90vw" className="object-cover transition-transform duration-[1.2s] ease-(--ease-soft) group-hover:scale-[1.04]" />
                  )}
                </div>
                <p className="type-display mt-4 text-3xl">{dict.categories[p.categorySlug].name}</p>
                <p className="mt-1 text-ink-2">{p.headline}</p>
                {p.startingPrice && (
                  <p className="mt-2 text-sm">
                    {pages.profile.from} {formatDzd(p.startingPrice, locale)}
                  </p>
                )}
              </Link>
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}
