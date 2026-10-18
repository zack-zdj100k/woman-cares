import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarX, ChevronLeft, Clock, LayoutGrid, Mail, MapPin, MessageCircle, Phone, Scissors, ShieldCheck, Sparkles, Star, UserRound } from "lucide-react";
import { categoryArt, isCategorySlug, type CategorySlug } from "@/config/categories";
import { specialtyLabel } from "@/config/specialties";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, getPagesDictionary, type Dictionary, type PagesDictionary } from "@/i18n/get-dictionary";
import { formatDate, formatDzd } from "@/lib/format";
import { weeklyHours } from "@/lib/time";
import { getPublicProfile, type PublicProfile } from "@/server/services/profiles";
import { PageShell } from "@/components/layout/page-shell";
import { ProfileGallery } from "@/components/profile/profile-gallery";
import { ViewBeacon } from "@/components/profile/view-beacon";
import { ArrowDot, buttonClass } from "@/components/ui/button";
import { FilmTitle } from "@/components/ui/film-title";
import { LocationMap } from "@/components/ui/expand-map";
import { Reveal } from "@/components/marketing/reveal";
import { BookingPanel, type BookableService } from "@/components/profile/booking-panel";
import { bookingCopy } from "@/lib/booking-copy";
import { getSessionUser } from "@/lib/auth/session";

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
  const price = (s: { priceMin: string; priceMax: string | null }) =>
    s.priceMax && s.priceMax !== s.priceMin ? `${formatDzd(s.priceMin, locale)} - ${formatDzd(s.priceMax, locale)}` : `${t.from} ${formatDzd(s.priceMin, locale)}`;
  const cover = profile.media.find((m) => m.type === "IMAGE")?.url ?? categoryArt[category].image;

  const facts = [
    pr.verified && { icon: BadgeCheck, text: t.verified },
    profile.regulated && { icon: ShieldCheck, text: t.regulated },
    { icon: MapPin, text: `${place}, ${pages.workplace[pr.workplaceType].toLowerCase()}` },
    profile.experienceYears ? { icon: Sparkles, text: t.experience(profile.experienceYears) } : null,
    profile.reviewCount > 0 && profile.rating !== null ? { icon: Star, text: `${profile.rating.toFixed(1)} / 5, ${t.reviewsCount(profile.reviewCount)}` } : null,
  ].filter(Boolean) as { icon: typeof MapPin; text: string }[];

  return (
    <article className="mx-auto max-w-[1400px] px-4 pt-4 pb-24 sm:px-8 lg:px-12">
      <ViewBeacon slug={profile.slug} />
      <Link prefetch href={`/${locale}/${category}`} className="mb-5 inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-sm text-ink-2 shadow-[inset_0_1px_0_white] hover:text-rose-ink">
        <ChevronLeft className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
        {dict.categories[category].name}
      </Link>

      {/* Identity: gallery card + soft identity card with the price on top */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="card-soft rounded-[32px] p-2.5">
          <ProfileGallery media={profile.media.map((m) => ({ id: m.id, type: m.type, url: m.url, alt: m.alt }))} name={pr.businessName} emptyLabel={t.noMedia} />
        </div>

        <div className="card-soft relative flex flex-col rounded-[32px] p-6 sm:p-8">
          {profile.startingPrice && (
            <a href="#reserver" className="price-glow float-soft inline-flex items-center gap-2 self-start rounded-full bg-[linear-gradient(180deg,#c25a73,#8e3249)] px-5 py-2.5 text-[0.95rem] font-medium text-white">
              <span className="opacity-80">{t.from}</span>
              {formatDzd(profile.startingPrice, locale)}
            </a>
          )}
          <p className="mt-6 text-sm text-ink-2">{dict.categories[category].name}</p>
          <FilmTitle as="h1" text={pr.businessName} image={cover} reveal="scale" className="mt-1 text-[clamp(2.4rem,4.6vw,4rem)]" />
          <p className="mt-4 text-lg leading-relaxed text-ink-2">{profile.headline}</p>

          <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl bg-white/70">
            {facts.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 px-4 py-3 text-[0.95rem]">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[linear-gradient(180deg,#f8e5e9,#f1d3da)] text-rose-ink">
                  <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#reserver" className={buttonClass({ variant: "solid", size: "lg", className: "pe-4" })}>
              {t.book.title}
              <ArrowDot />
            </a>
            <Link href={`/${locale}/providers/${pr.slug}`} className={buttonClass({ variant: "outline", size: "lg" })}>
              {t.seeProvider}
            </Link>
          </div>

          {profile.socialLinks.length > 0 && (
            <p className="mt-5 flex flex-wrap gap-2 text-sm">
              {profile.socialLinks.map((s) => (
                <a key={s.network} href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full bg-white/80 px-3 py-1.5 capitalize hover:text-rose-ink">
                  {s.network}
                </a>
              ))}
            </p>
          )}
        </div>
      </div>

      {/* Details: one floating card per subject, in reading order */}
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5">
          {(profile.description || pr.bio) && (
            <Card title={t.about} icon={UserRound} delay={0}>
              {profile.description && <p className="whitespace-pre-line text-[1.02rem] leading-relaxed">{profile.description}</p>}
              {pr.bio && <p className="mt-4 whitespace-pre-line leading-relaxed text-ink-2">{pr.bio}</p>}
            </Card>
          )}

          <Card title={t.services} icon={Scissors} delay={1}>
            {profile.services.length === 0 ? (
              <p className="text-ink-2">{t.noServices}</p>
            ) : (
              <>
                <ul className="grid gap-2">
                  {profile.services.map((s) => (
                    <li key={s.id} className="flex items-start justify-between gap-4 rounded-2xl bg-white/75 px-4 py-3.5">
                      <div>
                        <p className="font-medium">{s.name}</p>
                        {s.description && <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{s.description}</p>}
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-2">
                          <Clock className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          {t.duration(s.durationMinutes)}
                        </p>
                      </div>
                      <p className="shrink-0 rounded-full bg-[#f6e3e7] px-3 py-1 text-sm text-rose-ink">{price(s)}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-2">{t.priceNote}</p>
              </>
            )}
          </Card>

          {profile.specialties.length > 0 && (
            <Card title={t.specialties} icon={Sparkles} delay={2}>
              <ul className="flex flex-wrap gap-2">
                {profile.specialties.map((s) => (
                  <li key={s} className="rounded-full bg-white/80 px-4 py-2 text-sm shadow-[inset_0_1px_0_white,0_4px_10px_-8px_rgb(74_32_46/0.5)]">
                    {specialtyLabel(category, s, locale)}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(profile.hygieneNotes || profile.productNotes) && (
            <Card title={t.practices} icon={ShieldCheck} delay={3}>
              <p className="mb-4 text-xs text-ink-2">{t.declared}</p>
              <dl className="grid gap-3">
                {profile.hygieneNotes && (
                  <div className="rounded-2xl bg-white/75 px-4 py-3">
                    <dt className="font-medium">{t.hygiene}</dt>
                    <dd className="mt-1 whitespace-pre-line leading-relaxed text-ink-2">{profile.hygieneNotes}</dd>
                  </div>
                )}
                {profile.productNotes && (
                  <div className="rounded-2xl bg-white/75 px-4 py-3">
                    <dt className="font-medium">{t.products}</dt>
                    <dd className="mt-1 whitespace-pre-line leading-relaxed text-ink-2">{profile.productNotes}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}

          {profile.cancellationPolicy && (
            <Card title={t.policy} icon={CalendarX} delay={4}>
              <p className="whitespace-pre-line leading-relaxed text-ink-2">{profile.cancellationPolicy}</p>
            </Card>
          )}

          <Card title={t.reviews} icon={Star} delay={5}>
            {profile.reviews.length === 0 ? (
              <p className="text-ink-2">{t.noReviews}</p>
            ) : (
              <ul className="grid gap-3">
                {profile.reviews.map((r) => (
                  <li key={r.id} className="rounded-2xl bg-white/75 p-5">
                    <p className="flex items-center gap-1" aria-label={`${r.rating} / 5`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={i < r.rating ? "size-4 fill-current text-rose" : "size-4 text-ink/20"} strokeWidth={1.5} aria-hidden="true" />
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
          </Card>

          {pr.otherProfiles.length > 0 && (
            <Card title={t.alsoOffers} icon={LayoutGrid} delay={6}>
              <ul className="flex flex-wrap gap-2">
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
            </Card>
          )}

          <Card title={t.location} icon={MapPin} delay={7}>
            <p className="text-[1.02rem]">{place}</p>
            <p className="mt-1 text-ink-2">{pages.workplace[pr.workplaceType]}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">{t.locationNote}</p>
          </Card>
        </div>

        <aside className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5 lg:sticky lg:top-24 lg:self-start">
          <section id="reserver" aria-labelledby="book-title" className="card-soft scroll-mt-28 rounded-[30px] p-6">
            <h2 id="book-title" className="type-display mb-5 text-[2rem]">
              {t.book.title}
            </h2>
            {hasHours ? (
              <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />}>
                <BookingSlot
                  locale={locale}
                  slug={profile.slug}
                  copy={t.book}
                  services={profile.services.map((s) => ({ id: s.id, name: s.name, duration: t.duration(s.durationMinutes), price: price(s) }))}
                />
              </Suspense>
            ) : (
              <p className="text-ink-2">{t.book.noHours}</p>
            )}
            {(pr.publicPhone || pr.whatsapp || pr.publicEmail) && (
              <div className="mt-5 grid gap-2 text-sm">
                {pr.whatsapp && (
                  <a href={`https://wa.me/${pr.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "outline", size: "sm", className: "justify-self-start" })}>
                    <MessageCircle className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    {t.whatsapp}
                  </a>
                )}
                {pr.publicPhone && (
                  <a href={`tel:${pr.publicPhone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 text-ink-2 hover:text-rose-ink">
                    <Phone className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    <bdi dir="ltr">{pr.publicPhone}</bdi>
                  </a>
                )}
                {pr.publicEmail && (
                  <a href={`mailto:${pr.publicEmail}`} className="inline-flex items-center gap-2 break-all text-ink-2 hover:text-rose-ink">
                    <Mail className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <bdi dir="ltr">{pr.publicEmail}</bdi>
                  </a>
                )}
              </div>
            )}
            {pr.mapsUrl && <LocationMap href={pr.mapsUrl} location={place || pr.businessName} detail={pr.businessName} openLabel={t.openMaps} className="mt-5" />}
          </section>

          <section aria-labelledby="hours-title" className="card-soft rounded-[26px] p-4">
            <h2 id="hours-title" className="type-display px-1 text-[1.45rem]">
              {t.hours}
            </h2>
            {hasHours ? (
              <dl className="mt-2.5 grid gap-1 text-[0.85rem]">
                {hours.map((d) => (
                  <div key={d.weekday} className="flex justify-between gap-4 rounded-lg bg-white/70 px-3 py-1.5">
                    <dt className="text-ink-2">{pages.weekdays[d.weekday]}</dt>
                    <dd dir="ltr" className="text-end">
                      {d.ranges.length ? d.ranges.join(", ") : <span className="text-ink-2">{t.closed}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 px-1 text-sm text-ink-2">{t.noHours}</p>
            )}
          </section>

        </aside>
      </div>
    </article>
  );
}

/** Who is looking decides the booking button: guests sign in, clients send, others are told why not. */
async function BookingSlot({ locale, slug, copy, services }: { locale: Locale; slug: string; copy: PagesDictionary["profile"]["book"]; services: BookableService[] }) {
  const user = await getSessionUser();
  const viewer = !user ? "guest" : user.role === "CLIENT" ? (user.emailVerified ? "client" : "unverified") : "other";
  return (
    <BookingPanel
      locale={locale}
      profileSlug={slug}
      services={services}
      copy={bookingCopy(copy)}
      viewer={viewer}
      signInHref={`/${locale}/auth/sign-in?next=${encodeURIComponent(`/${locale}/profiles/${slug}`)}`}
      myBookingsHref={`/${locale}/dashboard/client`}
    />
  );
}

/** One subject per soft card, rising in as it scrolls into view and floating gently. */
function Card({ title, icon: Icon, delay, children }: { title: string; icon: typeof MapPin; delay: number; children: ReactNode }) {
  return (
    <Reveal delay={Math.min(delay * 0.05, 0.25)}>
      <section className="card-soft rounded-[30px] p-6 sm:p-7">
        <h2 className="mb-5 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-[linear-gradient(180deg,#f8e5e9,#f1d3da)] text-rose-ink shadow-[inset_0_1px_0_white]">
            <Icon className="size-5" strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span className="type-display text-[clamp(1.7rem,2.6vw,2.2rem)]">{title}</span>
        </h2>
        {children}
      </section>
    </Reveal>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto grid grid-cols-[minmax(0,1fr)] max-w-[1480px] gap-10 px-5 pt-16 pb-24 sm:px-8 lg:grid-cols-[7fr_5fr] lg:px-14" aria-hidden="true">
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
