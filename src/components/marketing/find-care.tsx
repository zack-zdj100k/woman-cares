"use client";

import { createContext, useCallback, useContext, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, LoaderCircle, X } from "lucide-react";
import { categorySlugs, type CategorySlug } from "@/config/categories";
import { wilayas } from "@/config/wilayas";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/fr";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Ctx = { open: (category?: CategorySlug) => void };
const FindCareContext = createContext<Ctx | null>(null);

/** Same as useFindCare, but returns null on pages without the search dialog. */
export function useFindCareOptional() {
  return useContext(FindCareContext);
}

export function useFindCare() {
  const ctx = useContext(FindCareContext);
  if (!ctx) throw new Error("useFindCare must be used inside <FindCareProvider>");
  return ctx;
}

type GeoState = "idle" | "locating" | "on" | "denied" | "unavailable";

/** Rounds coordinates to ~1 km so a shared search link never carries an exact position. */
const roundCoord = (n: number) => Math.round(n * 100) / 100;

export function FindCareProvider({
  locale,
  copy,
  categoryNames,
  children,
}: {
  locale: Locale;
  copy: Dictionary["search"];
  categoryNames: Record<CategorySlug, string>;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const ids = useId();
  const [category, setCategory] = useState<CategorySlug | "">("");
  const [categoryError, setCategoryError] = useState(false);
  const [geo, setGeo] = useState<GeoState>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const open = useCallback((preset?: CategorySlug) => {
    if (preset) setCategory(preset);
    dialogRef.current?.showModal();
  }, []);

  const close = () => dialogRef.current?.close();

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeo("unavailable");
      return;
    }
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: roundCoord(pos.coords.latitude), lng: roundCoord(pos.coords.longitude) });
        setGeo("on");
      },
      (err) => {
        setCoords(null);
        setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  const submit = (form: FormData) => {
    if (!category) {
      setCategoryError(true);
      return;
    }
    const params = new URLSearchParams();
    for (const key of ["wilaya", "commune", "q", "date"] as const) {
      const value = String(form.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    if (coords) {
      params.set("lat", String(coords.lat));
      params.set("lng", String(coords.lng));
      params.set("sort", "distance");
    }
    close();
    const qs = params.toString();
    router.push(`/${locale}/${category}${qs ? `?${qs}` : ""}`);
  };

  const field =
    "h-12 w-full rounded-(--radius-field) border border-ink/15 bg-ground px-4 text-[0.95rem] text-ink " +
    "placeholder:text-ink-2/70 transition-colors focus:border-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose/30";
  const label = "text-sm font-medium text-ink";

  return (
    <FindCareContext.Provider value={{ open }}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby={`${ids}-title`}
        className={cn(
          "find-care-dialog m-auto w-[min(34rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto",
          "rounded-(--radius-media) border border-line bg-parchment p-0 text-ink",
          "shadow-[0_40px_120px_-30px_rgb(37_22_29/0.55)] backdrop:bg-[rgb(22_10_16/0.55)] backdrop:backdrop-blur-sm",
        )}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <form action={submit} className="grid gap-5 p-6 sm:p-8" noValidate>
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1.5">
              <h2 id={`${ids}-title`} className="type-display text-4xl">
                {copy.title}
              </h2>
              <p className="text-[0.95rem] text-ink-2">{copy.intro}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={copy.close}
              className="grid size-10 shrink-0 place-items-center rounded-full border border-ink/15 text-ink transition-colors hover:bg-ink/5"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="grid gap-2">
            <label htmlFor={`${ids}-cat`} className={label}>
              {copy.category}
            </label>
            <select
              id={`${ids}-cat`}
              name="category"
              required
              value={category}
              aria-invalid={categoryError || undefined}
              aria-describedby={categoryError ? `${ids}-cat-err` : undefined}
              onChange={(e) => {
                setCategory(e.target.value as CategorySlug);
                setCategoryError(false);
              }}
              className={cn(field, categoryError && "border-rose")}
            >
              <option value="" disabled>
                {copy.chooseCategory}
              </option>
              {categorySlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {categoryNames[slug]}
                </option>
              ))}
            </select>
            {categoryError && (
              <p id={`${ids}-cat-err`} className="text-sm text-rose-ink">
                {copy.categoryRequired}
              </p>
            )}
          </div>

          <div className="grid gap-2 rounded-(--radius-field) border border-dashed border-ink/20 p-4">
            <button
              type="button"
              onClick={locate}
              disabled={geo === "locating"}
              aria-describedby={`${ids}-geo-help`}
              className={buttonClass({ variant: "outline", size: "sm", className: "justify-self-start" })}
            >
              {geo === "locating" ? (
                <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <LocateFixed className="size-4" strokeWidth={1.75} />
              )}
              {geo === "locating" ? copy.nearbyLocating : copy.nearby}
            </button>
            <p id={`${ids}-geo-help`} className="text-sm text-ink-2" aria-live="polite">
              {geo === "on"
                ? copy.nearbyOn
                : geo === "denied"
                  ? copy.nearbyDenied
                  : geo === "unavailable"
                    ? copy.nearbyUnavailable
                    : copy.nearbyHelp}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor={`${ids}-wilaya`} className={label}>
                {copy.wilaya}
              </label>
              <select id={`${ids}-wilaya`} name="wilaya" defaultValue="" className={field}>
                <option value="">{copy.anyWilaya}</option>
                {wilayas.map((w) => (
                  <option key={w.code} value={w.code}>
                    {String(w.code).padStart(2, "0")} {locale === "ar" ? w.ar : w.fr}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label htmlFor={`${ids}-commune`} className={label}>
                {copy.commune}
              </label>
              <input
                id={`${ids}-commune`}
                name="commune"
                autoComplete="address-level2"
                placeholder={copy.communePlaceholder}
                maxLength={80}
                className={field}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor={`${ids}-q`} className={label}>
                {copy.keyword}
              </label>
              <input
                id={`${ids}-q`}
                name="q"
                placeholder={copy.keywordPlaceholder}
                maxLength={80}
                className={field}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor={`${ids}-date`} className={label}>
                {copy.date}
              </label>
              <input id={`${ids}-date`} name="date" type="date" className={field} />
            </div>
          </div>

          <button type="submit" className={buttonClass({ variant: "solid", size: "lg", className: "w-full" })}>
            {copy.submit}
          </button>
        </form>
      </dialog>
    </FindCareContext.Provider>
  );
}
