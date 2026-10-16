import "server-only";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { isLocale, type Locale } from "./config";

/** Current locale from the [locale] root segment, validated. Usable in any Server Component. */
export async function getLocale(): Promise<Locale> {
  const value = await rootLocale();
  if (!value || !isLocale(value)) notFound();
  return value;
}
