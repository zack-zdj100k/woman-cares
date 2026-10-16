import { CURRENCY, TIMEZONE, type Locale } from "@/i18n/config";

const intlLocale: Record<Locale, string> = { fr: "fr-DZ", ar: "ar-DZ" };

/** Formats a DZD amount (string or number from Decimal) without decimals, e.g. "3 500 DA". */
export function formatDzd(amount: string | number, locale: Locale) {
  return new Intl.NumberFormat(intlLocale[locale], {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
    numberingSystem: "latn",
  }).format(Number(amount));
}

export function formatDate(date: Date, locale: Locale, opts: Intl.DateTimeFormatOptions = { dateStyle: "long" }) {
  return new Intl.DateTimeFormat(intlLocale[locale], { timeZone: TIMEZONE, numberingSystem: "latn", hourCycle: "h23", ...opts }).format(date);
}
