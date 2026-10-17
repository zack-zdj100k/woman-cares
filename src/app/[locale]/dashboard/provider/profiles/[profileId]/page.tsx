import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Check, ChevronLeft, Circle } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { specialtiesByCategory } from "@/config/specialties";
import { isLocale, type Locale } from "@/i18n/config";
import { getAuthDictionary, getDictionary, getPagesDictionary, getProviderDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { requireArea } from "@/lib/auth/session";
import { formatDate, formatDzd } from "@/lib/format";
import { publicMediaUrl } from "@/lib/storage/urls";
import { ForbiddenError } from "@/server/services/admin-users";
import { getEditorData, submissionChecklist, type ChecklistItem } from "@/server/services/provider-profiles";
import { DetailsForm } from "@/components/provider/details-form";
import { ServicesEditor } from "@/components/provider/services-editor";
import { MediaManager } from "@/components/provider/media-manager";
import { Closures, ScheduleEditor } from "@/components/provider/schedule-editor";
import { SubmitProfile } from "@/components/provider/submit-profile";
import { cn } from "@/lib/cn";
import { pageClass } from "@/components/dashboard/shell/dashboard-shell";

type Params = PageProps<"/[locale]/dashboard/provider/profiles/[profileId]">["params"];

export async function generateMetadata(): Promise<Metadata> {
  const pt = await getProviderDictionary(await getLocale());
  return { title: pt.profiles.edit, robots: { index: false } };
}

export default function EditorPage({ params }: { params: Params }) {
  return (
    <>
      <Editor params={params} />
    </>
  );
}

async function Editor({ params }: { params: Params }) {
  const { locale: l, profileId } = await params;
  if (!isLocale(l)) notFound();
  const locale: Locale = l;
  const user = await requireArea(locale, "provider", `/${locale}/dashboard/provider/profiles/${profileId}`);

  let data: Awaited<ReturnType<typeof getEditorData>>;
  let missing: ChecklistItem[];
  try {
    data = await getEditorData(user, profileId);
    ({ missing } = await submissionChecklist(user, profileId));
  } catch (e) {
    if (e instanceof ForbiddenError) notFound(); // other providers' profiles look exactly like missing ones
    throw e;
  }
  const [dict, pages, t, pt] = await Promise.all([getDictionary(locale), getPagesDictionary(locale), getAuthDictionary(locale), getProviderDictionary(locale)]);
  const { profile, editable } = data;
  const category = profile.category.slug as CategorySlug;
  const e = pt.editor;
  const social = (profile.socialLinks ?? {}) as Record<string, string>;
  const statusText =
    profile.status === "PUBLISHED" ? e.publication.published : profile.status === "PENDING_REVIEW" ? e.publication.pending : profile.status === "DRAFT" ? e.publication.draft : e.publication.restricted;
  const checklist: ChecklistItem[] = ["emailVerified", "details", "services", "photos", "hours"];

  return (
    <div className={pageClass}>
      <Link href={`/${locale}/dashboard/provider/profiles`} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-rose-ink">
        <ChevronLeft className="size-4 rtl:-scale-x-100" strokeWidth={1.75} />
        {e.back}
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="type-display text-[clamp(2.6rem,5vw,4rem)]">{dict.categories[category].name}</h1>
        <span className="rounded-full bg-surface px-3 py-1 text-sm">{t.dashboard.provider.profileStatuses[profile.status]}</span>
        {profile.status === "PUBLISHED" && (
          <Link href={`/${locale}/profiles/${profile.slug}`} className="inline-flex items-center gap-1 text-sm underline underline-offset-4">
            {e.publicPage}
            <ArrowUpRight className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
          </Link>
        )}
      </div>
      {!editable && <p className="mt-6 rounded-(--radius-field) bg-surface p-4 text-sm leading-relaxed text-rose-ink">{e.locked}</p>}

      <nav aria-label={dict.categories[category].name} className="sticky top-[4.5rem] z-10 -mx-5 mt-8 overflow-x-auto border-b border-line bg-ground/95 px-5 backdrop-blur sm:mx-0 sm:px-0">
        <ul className="flex gap-6 text-sm">
          {(Object.keys(e.sections) as (keyof typeof e.sections)[]).map((k) => (
            <li key={k}>
              <a href={`#${k}`} className="block whitespace-nowrap py-3 text-ink-2 hover:text-ink">
                {e.sections[k]}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="publication" title={e.sections.publication}>
        <p className="text-lg">{statusText}</p>
        {profile.reviewNote && (profile.status === "DRAFT" || profile.status === "SUSPENDED" || profile.status === "RESTRICTED") && (
          <p role="status" className="mt-4 rounded-(--radius-field) bg-surface p-4 leading-relaxed">
            {profile.status === "DRAFT" ? pt.review.changesRequested : pt.review.suspended} {profile.reviewNote}
          </p>
        )}
        <ul className="mt-5 grid gap-2">
          {checklist.map((item) => {
            const ok = !missing.includes(item);
            return (
              <li key={item} className={cn("flex items-center gap-3", ok ? "text-ink" : "text-ink-2")}>
                {ok ? <Check className="size-4 text-rose" strokeWidth={2} /> : <Circle className="size-4" strokeWidth={1.5} />}
                {e.publication.checklist[item]}
              </li>
            );
          })}
        </ul>
        {profile.status === "DRAFT" && editable && (
          <div className="mt-6">
            <SubmitProfile profileId={profile.id} labels={e.publication} checklistLabels={e.publication.checklist} errors={pt.common.errors} />
          </div>
        )}
      </Section>

      <Section id="details" title={e.sections.details}>
        <DetailsForm
          profileId={profile.id}
          disabled={!editable}
          copy={e.details}
          common={pt.common}
          specialtyOptions={specialtiesByCategory[category].map((s) => ({ slug: s.slug, label: s[locale] }))}
          initial={{
            headline: profile.headline,
            description: profile.description ?? "",
            experienceYears: profile.experienceYears,
            specialties: profile.specialties,
            hygieneNotes: profile.hygieneNotes ?? "",
            productNotes: profile.productNotes ?? "",
            cancellationPolicy: profile.cancellationPolicy ?? "",
            instagram: social.instagram ?? "",
            facebook: social.facebook ?? "",
            tiktok: social.tiktok ?? "",
          }}
        />
      </Section>

      <Section id="services" title={e.sections.services}>
        <ServicesEditor
          profileId={profile.id}
          disabled={!editable}
          copy={e.services}
          common={pt.common}
          services={data.services.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            durationMinutes: s.durationMinutes,
            bufferMinutes: s.bufferMinutes,
            priceMin: s.priceMin.toString(),
            priceMax: s.priceMax?.toString() ?? null,
            active: s.active,
          }))}
          formatPrice={Object.fromEntries(
            data.services.map((s) => [
              s.id,
              s.priceMax && !s.priceMax.equals(s.priceMin)
                ? `${formatDzd(s.priceMin.toString(), locale)} - ${formatDzd(s.priceMax.toString(), locale)}`
                : formatDzd(s.priceMin.toString(), locale),
            ]),
          )}
        />
      </Section>

      <Section id="portfolio" title={e.sections.portfolio}>
        <MediaManager
          profileId={profile.id}
          disabled={!editable}
          copy={e.portfolio}
          media={data.media.map((m) => ({ id: m.id, type: m.type, url: publicMediaUrl(m.storageKey), alt: m.altText, isCardImage: m.isCardImage }))}
        />
      </Section>

      <Section id="hours" title={e.sections.hours}>
        <ScheduleEditor profileId={profile.id} disabled={!editable} copy={e.hours} common={pt.common} weekdays={pages.weekdays} windows={data.schedules} />
        <div className="mt-12">
          <Closures
            profileId={profile.id}
            disabled={!editable}
            copy={e.hours}
            common={pt.common}
            closures={data.exceptions
              .filter((x) => x.isClosed)
              .map((x) => ({ id: x.id, note: x.note, label: formatDate(x.date, locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) }))}
          />
        </div>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-36 border-b border-line py-12 last:border-b-0">
      <h2 id={`${id}-title`} className="type-display mb-6 text-[clamp(2rem,3vw,2.6rem)]">
        {title}
      </h2>
      {children}
    </section>
  );
}
