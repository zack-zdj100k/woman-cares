import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { categoryArt, categorySlugs, isCategorySlug, type CategorySlug } from "@/config/categories";
import { specialtiesByCategory } from "@/config/specialties";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { getDictionary, getPagesDictionary, type PagesDictionary } from "@/i18n/get-dictionary";
import { directoryHref, parseDirectoryQuery, type DirectoryQuery } from "@/lib/validation/directory";
import { searchDirectory } from "@/server/services/directory";
import { PageShell } from "@/components/layout/page-shell";
import { DirectoryFilters } from "@/components/directory/directory-filters";
import { ProviderCard } from "@/components/directory/provider-card";
import { cn } from "@/lib/cn";

export function generateStaticParams() {
  return locales.flatMap((locale) => categorySlugs.map((category) => ({ locale, category })));
}

async function resolve(params: PageProps<"/[locale]/[category]">["params"]) {
  const { locale, category } = await params;
  if (!isLocale(locale) || !isCategorySlug(category)) notFound();
  return { locale, category };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/[category]">): Promise<Metadata> {
  const { locale, category } = await resolve(params);
  const pages = await getPagesDictionary(locale);
  const intro = pages.directory.intros[category];
  return { title: intro.title, description: intro.intro };
}

export default function CategoryPage({ params, searchParams }: PageProps<"/[locale]/[category]">) {
  return (
    <PageShell>
      <Suspense fallback={<DirectorySkeleton />}>
        <Directory params={params} searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Directory({ params, searchParams }: PageProps<"/[locale]/[category]">) {
  const { locale, category } = await resolve(params);
  const [dict, pages] = await Promise.all([getDictionary(locale), getPagesDictionary(locale)]);
  const intro = pages.directory.intros[category];
  const action = `/${locale}/${category}`;
  const art = categoryArt[category];

  return (
    <>
      <header className="mx-auto grid max-w-[1480px] items-end gap-8 px-5 pt-10 pb-10 sm:px-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:pt-16 md:pb-14 lg:px-14">
        <div>
          <h1 className="type-display text-[clamp(3rem,7vw,6rem)]">{intro.title}</h1>
          <p className="mt-5 max-w-[38rem] text-lg leading-relaxed text-ink-2">{intro.intro}</p>
          {art.regulated && (
            <p className="mt-6 flex max-w-[38rem] gap-3 rounded-(--radius-field) bg-surface p-4 text-sm leading-relaxed">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-rose" strokeWidth={1.75} aria-hidden="true" />
              {pages.directory.regulatedNotice}
            </p>
          )}
        </div>
        <div className="relative hidden aspect-[16/10] overflow-hidden rounded-(--radius-media) md:block">
          <Image src={art.image} alt="" fill loading="eager" fetchPriority="high" sizes="40vw" className="object-cover" />
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] grid-cols-[minmax(0,1fr)] gap-8 px-5 pb-24 sm:px-8 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-12 lg:px-14">
        <Suspense fallback={<FiltersSkeleton />}>
          <Filters searchParams={searchParams} locale={locale} category={category} action={action} pages={pages} geo={dict.search} />
        </Suspense>
        <section aria-label={intro.title} aria-live="polite">
          <Suspense fallback={<ResultsSkeleton />}>
            <Results searchParams={searchParams} locale={locale} category={category} pages={pages} />
          </Suspense>
        </section>
      </div>
    </>
  );
}

function DirectorySkeleton() {
  return (
    <div className="mx-auto max-w-[1480px] px-5 pt-16 sm:px-8 lg:px-14" aria-hidden="true">
      <div className="h-20 w-2/3 max-w-[30rem] animate-pulse rounded-2xl bg-surface-2" />
      <div className="mt-6 h-4 w-full max-w-[36rem] animate-pulse rounded-full bg-surface-2" />
      <div className="mt-16">
        <ResultsSkeleton />
      </div>
    </div>
  );
}

type SP = PageProps<"/[locale]/[category]">["searchParams"];

async function Filters({
  searchParams,
  locale,
  category,
  action,
  pages,
  geo,
}: {
  searchParams: SP;
  locale: Locale;
  category: CategorySlug;
  action: string;
  pages: PagesDictionary;
  geo: { nearbyDenied: string; nearbyUnavailable: string; nearbyHelp: string };
}) {
  const query = parseDirectoryQuery(await searchParams);
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <DirectoryFilters
        key={JSON.stringify(query)}
        locale={locale}
        action={action}
        query={query}
        labels={pages.directory.filters}
        specialties={specialtiesByCategory[category].map((s) => ({ slug: s.slug, label: s[locale] }))}
        geoMessages={{ denied: geo.nearbyDenied, unavailable: geo.nearbyUnavailable, help: geo.nearbyHelp }}
      />
    </aside>
  );
}

async function Results({
  searchParams,
  locale,
  category,
  pages,
}: {
  searchParams: SP;
  locale: Locale;
  category: CategorySlug;
  pages: PagesDictionary;
}) {
  const query = parseDirectoryQuery(await searchParams);
  const result = await searchDirectory(category, query);
  const d = pages.directory;
  const filtered = Object.entries(query).some(([k, v]) => k !== "sort" && k !== "page" && v !== undefined && v !== false);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-lg font-medium">{d.results(result.total)}</p>
        {query.lat !== undefined && <p className="text-sm text-ink-2">{d.distanceNote}</p>}
      </div>

      {result.cards.length === 0 ? (
        <div className="rounded-(--radius-media) bg-parchment px-8 py-14 text-center md:py-20">
          <p className="type-display text-[clamp(1.9rem,3vw,2.6rem)]">{d.emptyTitle}</p>
          <p className="mx-auto mt-4 max-w-[34rem] text-ink-2">{filtered ? d.emptyFiltered : d.emptyCategory}</p>
          <div className="mt-8 flex flex-col items-center gap-4">
            {filtered && (
              <Link href={`/${locale}/${category}`} className="text-rose-ink underline underline-offset-4">
                {d.filters.reset}
              </Link>
            )}
            <Link
              href={`/${locale}/about-services`}
              className="inline-flex items-center gap-1.5 text-sm text-ink-2 underline decoration-ink/25 underline-offset-4 hover:text-rose-ink"
            >
              {d.proLink}
              <ArrowUpRight className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {result.cards.map((card, i) => (
            <li key={card.slug} className="flex">
              <ProviderCard card={card} category={category} locale={locale} copy={d.card} workplace={pages.workplace} index={i} />
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 && <Pagination locale={locale} category={category} query={query} page={result.page} pageCount={result.pageCount} copy={d.pagination} />}
    </>
  );
}

function Pagination({
  locale,
  category,
  query,
  page,
  pageCount,
  copy,
}: {
  locale: Locale;
  category: CategorySlug;
  query: DirectoryQuery;
  page: number;
  pageCount: number;
  copy: PagesDictionary["directory"]["pagination"];
}) {
  const href = (p: number) => directoryHref(locale, category, { ...query, page: p });
  const pagesToShow = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1);
  const item = "grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm transition-colors";
  return (
    <nav aria-label={copy.label} className="mt-14 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} className={cn(item, "border border-line hover:bg-surface")} rel="prev">
          {copy.previous}
        </Link>
      )}
      {pagesToShow.map((p, i) => (
        <span key={p} className="flex items-center gap-2">
          {i > 0 && pagesToShow[i - 1] !== p - 1 && <span aria-hidden="true">…</span>}
          <Link
            href={href(p)}
            aria-label={copy.page(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(item, p === page ? "bg-ink text-ground" : "border border-line hover:bg-surface")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount && (
        <Link href={href(page + 1)} className={cn(item, "border border-line hover:bg-surface")} rel="next">
          {copy.next}
        </Link>
      )}
    </nav>
  );
}

function FiltersSkeleton() {
  return <div className="h-[28rem] animate-pulse rounded-(--radius-media) bg-surface max-lg:h-11 max-lg:w-32" aria-hidden="true" />;
}

function ResultsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-6 h-6 w-32 animate-pulse rounded-full bg-surface-2" />
      <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[4/5] animate-pulse rounded-(--radius-media) bg-surface-2" />
            <div className="mt-4 h-4 w-2/3 animate-pulse rounded-full bg-surface-2" />
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
