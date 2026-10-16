import type { Metadata } from "next";
import Image from "next/image";
import { getPagesDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { PageShell } from "@/components/layout/page-shell";
import { ContactForm } from "@/components/content/contact-form";

export async function generateMetadata(): Promise<Metadata> {
  const pages = await getPagesDictionary(await getLocale());
  return { title: pages.contact.metaTitle, description: pages.contact.intro };
}

export default async function ContactPage() {
  const pages = await getPagesDictionary(await getLocale());
  const c = pages.contact;
  return (
    <PageShell>
      <div className="mx-auto grid max-w-[1480px] gap-12 px-5 pt-12 pb-24 sm:px-8 md:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20 lg:px-14">
        <div>
          <h1 className="type-display text-[clamp(3rem,6vw,5.5rem)]">{c.title}</h1>
          <p className="mt-5 max-w-[30rem] text-lg leading-relaxed text-ink-2">{c.intro}</p>
          <div className="relative mt-10 hidden aspect-[9/14] max-w-[18rem] overflow-hidden rounded-(--radius-media) lg:block">
            <Image src="/images/backgrounds/blush-butterflies.jpg" alt="" fill sizes="18rem" className="object-cover" />
          </div>
        </div>
        <div className="lg:pt-6">
          <ContactForm copy={c} />
        </div>
      </div>
    </PageShell>
  );
}
