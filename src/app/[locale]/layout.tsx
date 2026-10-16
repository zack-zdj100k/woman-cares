import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Amiri, Cormorant_Garamond, IBM_Plex_Sans_Arabic, Outfit } from "next/font/google";
import { isLocale, localeDirection, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { SiteBackdrop } from "@/components/layout/site-backdrop";
import "../globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const amiri = Amiri({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-amiri", display: "swap" });
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-arabic",
  display: "swap",
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: { default: dict.meta.title, template: `%s | ${dict.brand.name}` },
    description: dict.meta.description,
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    alternates: { languages: { fr: "/fr", ar: "/ar" } },
  };
}

export const viewport: Viewport = {
  themeColor: "#f6eae2",
  colorScheme: "light",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html
      lang={locale}
      dir={localeDirection[locale]}
      className={`${cormorant.variable} ${outfit.variable} ${amiri.variable} ${plexArabic.variable} antialiased`}
    >
      <body className="min-h-dvh">
        <SiteBackdrop />
        {children}
      </body>
    </html>
  );
}
