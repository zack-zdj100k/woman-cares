import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, ChevronLeft, MapPin, Phone, ShieldCheck, Star } from "lucide-react";
import { isCategorySlug, type CategorySlug } from "@/config/categories";
import { specialtyLabel } from "@/config/specialties";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, getPagesDictionary, type Dictionary, type PagesDictionary } from "@/i18n/get-dictionary";
import { formatDate, formatDzd } from "@/lib/format";
import { weeklyHours } from "@/lib/time";
import { getPublicProfile, type PublicProfile } from "@/server/services/profiles";
import { PageShell } from "@/components/layout/page-shell";
import { ProfileGallery } from "@/components/profile/profile-gallery";
import { ViewBeacon } from "@/components/profile/view-beacon";
import { buttonClass } from "@/components/ui/button";

type Params = PageProps<"/[locale]/profiles/[profileSlug]">["params"];

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, profileSlug } = await params;
  if (!isLocale(locale)) return {};
  const profile = await getPublicProfile(profileSlug);
  if (!profile) return {};
  const dict = await getDictionary(locale);
  const category = isCategorySlug(profile.categorySlug) ? dict.categories[profile.categorySlug].name : "";
  return {
    title: `${profile.provider.businessName}, ${category}`,
    description: profile.headline,
  };
}

export default function ProfilePage({ params }: { params: Params }) {
  return (
    <PageShell>
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent params={params} />
      </Suspense>
    </PageShell>
  );
}

async function ProfileContent({ params }: { params: Params }) {
  const { locale, profileSlug } = await params;
  if (!isLocale(locale)) notFound();
  const profile = await getPublicProfile(profileSlug);
  if (!profile || !isCategorySlug(profile.categorySlug)) notFound();
  const [dict, pages] = await Promise.all([getDictionary(locale), getPagesDictionary(locale)]);
  return <Profile profile={profile} category={profile.categorySlug} locale={locale} dict={dict} pages={pages} />;
}

function Profile({
  profile,
  category,
  locale,
  dict,
  pages,
}: {
  profile: PublicProfile;
  category: CategorySlug;
  locale: Locale;
  dict: Dictionary;
  pages: PagesDictionary;
}) {
  const t = pages.profile;
  const pr = profile.provider;
  const place = [locale === "ar" ? pr.communeAr : pr.communeFr, locale === "ar" ? pr.wilayaAr : pr.wilayaFr].filter(Boolean).join(", ");
  const hours = weeklyHours(profile.schedules);
  const hasHours = profile.schedules.length > 0;

  return (
    <article className="mx-auto max-w-[1480px] px-5 pt-8 pb-24 sm:px-8 lg:px-14">
      <ViewBeacon slug={profile.slug} />
      <Link
        href={`/${locale}/${category}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-rose-ink"
      >
        <ChevronLeft className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
        {dict.categories[category].name}
      </Link>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
        <ProfileGallery
          media={profile.media.map((m) => ({ id: m.id, type: m.type, url: m.url, alt: m.alt }))}
          name={pr.businessName}
          emptyLabel={t.noMedia}
        />

        <div className="lg:pt-4">
          <p className="text-sm text-ink-2">{dict.categories[category].name}</p>
          <h1 className="type-display mt-2 text-[clamp(2.6rem,5vw,4.5rem)]">{pr.businessName}</h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">{profile.headline}</p>

          <ul className="mt-6 grid gap-2.5 text-[0.95rem]">
            {pr.verified && (
              <li className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-rose" strokeWidth={1.75} aria-hidden="true" />
                {t.verified}
              </li>
            )}
            {profile.regulated && (
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-rose" strokeWidth={1.75} aria-hidden="true" />
                {t.regulated}
              </li>
            )}
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-ink-2" strokeWidth={1.75} aria-hidden="true" />
              {place}, {pages.workplace[pr.workplaceType].toLowerCase()}
            </li>
            {profile.experienceYears ? <li className="ps-6">{t.experience(profile.experienceYears)}</li> : null}
            {profile.reviewCount > 0 && profile.rating !== null && (
              <li className="flex items-center gap-2">
                <Star className="size-4 fill-current text-rose" strokeWidth={1.5} aria-hidden="true" />
                {profile.rating.toFixed(1)} / 5, {t.reviewsCount(profile.reviewCount)}
              </li>
            )}
          </ul>

          {profile.startingPrice && (
            <p className="mt-6 text-lg">
              <span className="text-ink-2">{t.from}</span>{" "}
              <span className="font-medium">{formatDzd(profile.startingPrice, locale)}</span>
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#reserver" className={buttonClass({ variant: "solid", size: "lg" })}>
              {t.book.title}
            </a>
            <Link href={`/${locale}/providers/${pr.slug}`} className={buttonClass({ variant: "outline", size: "lg" })}>
              {t.seeProvider}
            </Link>
          </div>

          {profile.socialLinks.length > 0 && (
            <p className="mt-6 flex flex-wrap gap-4 text-sm">
              <span className="text-ink-2">{t.social}</span>
              {profile.socialLinks.map((s) => (
                <a key={s.network} href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="capitalize underline underline-offset-4 hover:text-rose-ink">
                  {s.network}
                </a>
              ))}
            </p>
          )}
        </div>
      </div>

      <div className="mt-20 grid gap-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
        <div className="grid gap-16">
          {(profile.description || pr.bio) && (
            <Section title={t.about}>
              {profile.description && <p className="whitespace-pre-line text-[1.05rem] leading-relaxed">{profile.description}</p>}
              {pr.bio && <p className="mt-4 whitespace-pre-line leading-relaxed text-ink-2">{pr.bio}</p>}
            </Section>
          )}

          {profile.specialties.length > 0 && (
            <Section title={t.specialties}>
              <ul className="flex flex-wrap gap-2">
                {profile.specialties.map((s) => (
                  <li key={s} className="rounded-full border border-line px-4 py-2 text-sm">
                    {specialtyLabel(category, s, locale)}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={t.services}>
            {profile.services.length === 0 ? (
              <p className="text-ink-2">{t.noServices}</p>
            ) : (
              <>
                <ul className="divide-y divide-line border-y border-line">
                  {profile.services.map((s) => (
                    <li key={s.id} className="flex items-start justify-between gap-6 py-5">
                      <div>
                        <p className="text-[1.05rem] font-medium">{s.name}</p>
                        {s.description && <p className="mt-1 text-sm leading-relaxed text-ink-2">{s.description}</p>}
                        <p className="mt-1 text-sm text-ink-2">{t.duration(s.durationMinutes)}</p>
                      </div>
                      <p className="shrink-0 text-end">
                        {s.priceMax && s.priceMax !== s.priceMin
                          ? `${formatDzd(s.priceMin, locale)} - ${formatDzd(s.priceMax, locale)}`
                          : `${t.from} ${formatDzd(s.priceMin, locale)}`}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm text-ink-2">{t.priceNote}</p>
              </>
            )}
          </Section>

          {(profile.hygieneNotes || profile.productNotes) && (
            <Section title={t.practices}>
              <p className="mb-4 text-sm text-ink-2">{t.declared}</p>
              <dl className="grid gap-4">
                {profile.hygieneNotes && (
                  <div>
                    <dt className="font-medium">{t.hygiene}</dt>
                    <dd className="mt-1 whitespace-pre-line leading-relaxed text-ink-2">{profile.hygieneNotes}</dd>
                  </div>
                )}
                {profile.productNotes && (
                  <div>
                    <dt className="font-medium">{t.products}</dt>
                    <dd className="mt-1 whitespace-pre-line leading-relaxed text-ink-2">{profile.productNotes}</dd>
                  </div>
                )}
              </dl>
            </Section>
          )}

          {profile.cancellationPolicy && (
            <Section title={t.policy}>
              <p className="whitespace-pre-line leading-relaxed text-ink-2">{profile.cancellationPolicy}</p>
            </Section>
          )}

          <Section title={t.reviews}>
            {profile.reviews.length === 0 ? (
              <p className="text-ink-2">{t.noReviews}</p>
            ) : (
              <ul className="grid gap-6">
                {profile.reviews.map((r) => (
                  <li key={r.id} className="rounded-(--radius-media) bg-surface p-6">
                    <p className="flex items-center gap-1" aria-label={`${r.rating} / 5`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={i < r.rating ? "size-4 fill-current text-rose" : "size-4 text-ink/20"}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      ))}
                    </p>
                    {r.comment && <p className="mt-3 line-clamp-3 leading-relaxed">{r.comment}</p>}
                    <p className="mt-3 text-sm text-ink-2">
                      {r.author}, {formatDate(new Date(r.createdAt), locale, { month: "long", year: "numeric" })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {pr.otherProfiles.length > 0 && (
            <Section title={t.alsoOffers}>
              <ul className="flex flex-wrap gap-3">
                {pr.otherProfiles.map((o) =>
                  isCategorySlug(o.categorySlug) ? (
                    <li key={o.slug}>
                      <Link href={`/${locale}/profiles/${o.slug}`} className={buttonClass({ variant: "outline", size: "sm" })}>
                        {dict.categories[o.categorySlug].name}
                      </Link>
                    </li>
                  ) : null,
                )}
              </ul>
            </Section>
          )}
        </div>

        <aside className="grid content-start gap-6 lg:sticky lg:top-24 lg:self-start">
          <div id="reserver" className="scroll-mt-28 rounded-(--radius-media) bg-parchment p-7">
            <h2 className="type-display text-3xl">{t.book.title}</h2>
            <p className="mt-3 leading-relaxed text-ink-2">{t.book.soon}</p>
            {pr.publicPhone ? (
              <a href={`tel:${pr.publicPhone.replace(/[^\d+]/g, "")}`} className={buttonClass({ variant: "solid", className: "mt-6" })}>
                <Phone className="size-4" strokeWidth={1.75} />
                {t.book.call} {pr.publicPhone}
              </a>
            ) : (
              <p className="mt-4 text-sm text-ink-2">{t.book.noPhone}</p>
            )}
          </div>

          <div className="rounded-(--radius-media) border border-line p-7">
            <h2 className="type-display text-3xl">{t.hours}</h2>
            {hasHours ? (
              <dl className="mt-5 grid gap-2.5 text-[0.95rem]">
                {hours.map((d) => (
                  <div key={d.weekday} className="flex justify-between gap-4">
                    <dt className="text-ink-2">{pages.weekdays[d.weekday]}</dt>
                    <dd dir="ltr" className="text-end">
                      {d.ranges.length ? d.ranges.join(", ") : <span className="text-ink-2">{t.closed}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-4 text-ink-2">{t.noHours}</p>
            )}
          </div>

          <div className="rounded-(--radius-media) border border-line p-7">
            <h2 className="type-display text-3xl">{t.location}</h2>
            <p className="mt-4">{place}</p>
            <p className="mt-1 text-ink-2">{pages.workplace[pr.workplaceType]}</p>
            <p className="mt-4 text-sm leading-relaxed text-ink-2">{t.locationNote}</p>
          </div>
        </aside>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="type-display mb-6 text-[clamp(2rem,3vw,2.75rem)]">{title}</h2>
      {children}
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto grid max-w-[1480px] gap-10 px-5 pt-16 pb-24 sm:px-8 lg:grid-cols-[7fr_5fr] lg:px-14" aria-hidden="true">
      <div className="aspect-[5/4] animate-pulse rounded-(--radius-media) bg-surface-2" />
      <div className="grid content-start gap-4">
        <div className="h-4 w-24 animate-pulse rounded-full bg-surface-2" />
        <div className="h-14 w-3/4 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-4 w-full animate-pulse rounded-full bg-surface-2" />
        <div className="h-4 w-2/3 animate-pulse rounded-full bg-surface-2" />
      </div>
    </div>
  );
}
