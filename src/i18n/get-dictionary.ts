import "server-only";
import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries/fr";
import type { PagesDictionary } from "./dictionaries/pages.fr";
import type { AuthDictionary } from "./dictionaries/auth.fr";
import type { ProviderDictionary } from "./dictionaries/provider.fr";

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  fr: () => import("./dictionaries/fr").then((m) => m.default),
  ar: () => import("./dictionaries/ar").then((m) => m.default),
};

const pageLoaders: Record<Locale, () => Promise<PagesDictionary>> = {
  fr: () => import("./dictionaries/pages.fr").then((m) => m.default),
  ar: () => import("./dictionaries/pages.ar").then((m) => m.default),
};

export function getDictionary(locale: Locale): Promise<Dictionary> {
  return loaders[locale]();
}

/** Copy for directory, profile and content pages (kept apart from the homepage dictionary). */
export function getPagesDictionary(locale: Locale): Promise<PagesDictionary> {
  return pageLoaders[locale]();
}

const authLoaders: Record<Locale, () => Promise<AuthDictionary>> = {
  fr: () => import("./dictionaries/auth.fr").then((m) => m.default),
  ar: () => import("./dictionaries/auth.ar").then((m) => m.default),
};

/** Copy for sign-in, sign-up, verification, password reset, account menu and dashboards. */
export function getAuthDictionary(locale: Locale): Promise<AuthDictionary> {
  return authLoaders[locale]();
}

const providerLoaders: Record<Locale, () => Promise<ProviderDictionary>> = {
  fr: () => import("./dictionaries/provider.fr").then((m) => m.default),
  ar: () => import("./dictionaries/provider.ar").then((m) => m.default),
};

/** Copy for the professional space (profiles editor, schedule, media, settings). */
export function getProviderDictionary(locale: Locale): Promise<ProviderDictionary> {
  return providerLoaders[locale]();
}

export type { Dictionary, PagesDictionary, AuthDictionary, ProviderDictionary };
