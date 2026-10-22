import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Info } from "lucide-react";
import { legalDocs, legalDrafts, type LegalDocKey } from "@/content/legal";
import { isLocale, locales } from "@/i18n/config";
import { getPagesDictionary } from "@/i18n/get-dictionary";
import { formatDate } from "@/lib/format";
import { getLegalDocument } from "@/server/services/legal";
import { getPublisher } from "@/server/services/site-settings";
import { PageShell } from "@/components/layout/page-shell";

export function generateStaticParams() {
  return locales.flatMap((locale) => legalDocs.map((doc) => ({ locale, doc })));
}

function isDoc(value: string): value is LegalDocKey {
  return (legalDocs as readonly string[]).includes(value);
}

export async function generateMetadata({ params }: PageProps<"/[locale]/legal/[doc]">): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!isLocale(locale) || !isDoc(doc)) return {};
  return { title: legalDrafts[doc][locale].title };
}

export default function LegalPage({ params }: PageProps<"/[locale]/legal/[doc]">) {
  return (
    <PageShell>
      <Suspense fallback={<div className="mx-auto h-96 max-w-[46rem] animate-pulse" aria-hidden="true" />}>
        <LegalBody params={params} />
      </Suspense>
    </PageShell>
  );
}

async function LegalBody({ params }: { params: PageProps<"/[locale]/legal/[doc]">["params"] }) {
  const { locale, doc } = await params;
  if (!isLocale(locale) || !isDoc(doc)) notFound();
  await connection();
  const [{ doc: content, draft, publishedAt }, pages, publisher] = await Promise.all([getLegalDocument(doc, locale), getPagesDictionary(locale), getPublisher()]);
  const pub = pages.legal.publisher;
  return (
    <article className="mx-auto max-w-[46rem] px-5 pt-12 pb-24 sm:px-8 md:pt-16">
      <h1 className="type-display text-[clamp(2.75rem,5vw,4.5rem)]">{content.title}</h1>
      {draft ? (
        <p className="mt-6 flex gap-3 rounded-(--radius-field) bg-surface p-4 text-sm leading-relaxed">
          <Info className="mt-0.5 size-5 shrink-0 text-rose" strokeWidth={1.75} aria-hidden="true" />
          {pages.legal.draftNotice}
        </p>
      ) : (
        publishedAt && (
          <p className="mt-4 text-sm text-ink-2">
            {pages.legal.updated} : {formatDate(new Date(publishedAt), locale)}
          </p>
        )
      )}
      <div className="mt-12 grid gap-10">
        {content.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-xl font-medium">{s.heading}</h2>
            <div className="mt-3 grid gap-3 leading-relaxed text-ink-2">
              {s.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}
        {publisher && (
          <section aria-labelledby="publisher-title">
            <h2 id="publisher-title" className="text-xl font-medium">
              {pub.title}
            </h2>
            <dl className="mt-3 grid gap-2 leading-relaxed text-ink-2">
              {(
                [
                  [pub.name, publisher.name, false],
                  [pub.rc, publisher.rc, true],
                  [pub.nif, publisher.nif, true],
                  [pub.address, publisher.address, false],
                  [pub.phone, publisher.phone, true],
                  [pub.email, publisher.email, true],
                ] as const
              )
                .filter(([, value]) => value)
                .map(([label, value, ltr]) => (
                  <div key={label} className="flex flex-wrap gap-x-3">
                    <dt className="font-medium text-ink">{label}</dt>
                    <dd dir={ltr ? "ltr" : undefined}>{value}</dd>
                  </div>
                ))}
            </dl>
          </section>
        )}
      </div>
    </article>
  );
}
