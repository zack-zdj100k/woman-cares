"use client";

import { useRef, useState } from "react";
import { LocateFixed, LoaderCircle, SlidersHorizontal, X } from "lucide-react";
import { wilayas } from "@/config/wilayas";
import type { Locale } from "@/i18n/config";
import type { PagesDictionary } from "@/i18n/dictionaries/pages.fr";
import { MAX_KM_OPTIONS, SORTS, type DirectoryQuery } from "@/lib/validation/directory";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Labels = PagesDictionary["directory"]["filters"];

/**
 * A plain GET form: filters live in the URL, results are computed on the server, and the
 * form works without JavaScript. JavaScript only adds the opt-in "near me" geolocation.
 */
export function DirectoryFilters({
  locale,
  action,
  query,
  labels,
  specialties,
  geoMessages,
}: {
  locale: Locale;
  action: string;
  query: DirectoryQuery;
  labels: Labels;
  specialties: { slug: string; label: string }[];
  geoMessages: { denied: string; unavailable: string; help: string };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [coords, setCoords] = useState(query.lat !== undefined ? { lat: query.lat, lng: query.lng! } : null);
  const [geo, setGeo] = useState<"idle" | "locating" | "denied" | "unavailable">("idle");
  const [mobileOpen, setMobileOpen] = useState(false);

  const locate = () => {
    if (!("geolocation" in navigator)) return setGeo("unavailable");
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: Math.round(pos.coords.latitude * 100) / 100,
          lng: Math.round(pos.coords.longitude * 100) / 100,
        };
        setCoords(next);
        setGeo("idle");
        // Wait for the hidden inputs to render, then submit with distance sorting.
        requestAnimationFrame(() => {
          const sort = formRef.current?.elements.namedItem("sort") as HTMLSelectElement | null;
          if (sort) sort.value = "distance";
          formRef.current?.requestSubmit();
        });
      },
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  const field =
    "h-11 w-full rounded-(--radius-field) border border-ink/15 bg-ground px-3.5 text-[0.95rem] text-ink transition-colors focus:border-rose focus:outline-none";
  const label = "text-sm font-medium text-ink";

  return (
    <div>
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        aria-expanded={mobileOpen}
        aria-controls="directory-filters"
        className={buttonClass({ variant: "outline", size: "sm", className: "mb-4 lg:hidden" })}
      >
        {mobileOpen ? <X className="size-4" strokeWidth={1.75} /> : <SlidersHorizontal className="size-4" strokeWidth={1.75} />}
        {labels.title}
      </button>

      <form
        ref={formRef}
        id="directory-filters"
        method="get"
        action={action}
        onSubmit={(e) => {
          // Keep shareable URLs short: empty fields are left out of the query string.
          const empty = Array.from(e.currentTarget.elements).filter(
            (el): el is HTMLInputElement => "name" in el && "value" in el && !!(el as HTMLInputElement).name && !(el as HTMLInputElement).value,
          );
          empty.forEach((el) => (el.disabled = true));
          setTimeout(() => empty.forEach((el) => (el.disabled = false)));
        }}
        className={cn("grid gap-5 rounded-(--radius-media) border border-line bg-ground p-5 lg:grid", mobileOpen ? "grid" : "max-lg:hidden")}
      >
        <div className="grid gap-2">
          <button
            type="button"
            onClick={locate}
            disabled={geo === "locating"}
            className={buttonClass({ variant: coords ? "solid" : "outline", size: "sm", className: "justify-self-start" })}
          >
            {geo === "locating" ? (
              <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <LocateFixed className="size-4" strokeWidth={1.75} />
            )}
            {coords ? labels.nearbyActive : labels.nearby}
          </button>
          <p className="text-xs leading-relaxed text-ink-2" aria-live="polite">
            {geo === "denied" ? geoMessages.denied : geo === "unavailable" ? geoMessages.unavailable : geoMessages.help}
          </p>
          {coords && (
            <>
              <input type="hidden" name="lat" value={coords.lat} />
              <input type="hidden" name="lng" value={coords.lng} />
              <button
                type="button"
                onClick={() => setCoords(null)}
                className="justify-self-start text-xs text-ink-2 underline underline-offset-4 hover:text-rose-ink"
              >
                {labels.nearbyClear}
              </button>
            </>
          )}
        </div>

        {coords && (
          <div className="grid gap-2">
            <label htmlFor="f-maxKm" className={label}>
              {labels.distance}
            </label>
            <select id="f-maxKm" name="maxKm" defaultValue={query.maxKm ?? ""} className={field}>
              <option value="">{labels.anyDistance}</option>
              {MAX_KM_OPTIONS.map((km) => (
                <option key={km} value={km}>
                  {km} {labels.km}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid gap-2">
          <label htmlFor="f-wilaya" className={label}>
            {labels.wilaya}
          </label>
          <select id="f-wilaya" name="wilaya" defaultValue={query.wilaya ?? ""} className={field}>
            <option value="">{labels.anyWilaya}</option>
            {wilayas.map((w) => (
              <option key={w.code} value={w.code}>
                {String(w.code).padStart(2, "0")} {locale === "ar" ? w.ar : w.fr}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label htmlFor="f-commune" className={label}>
            {labels.commune}
          </label>
          <input id="f-commune" name="commune" defaultValue={query.commune ?? ""} maxLength={80} className={field} />
        </div>

        <div className="grid gap-2">
          <label htmlFor="f-q" className={label}>
            {labels.q}
          </label>
          <input
            id="f-q"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder={labels.qPlaceholder}
            maxLength={80}
            className={cn(field, "placeholder:text-ink-2/70")}
          />
        </div>

        {specialties.length > 0 && (
          <div className="grid gap-2">
            <label htmlFor="f-specialty" className={label}>
              {labels.specialty}
            </label>
            <select id="f-specialty" name="specialty" defaultValue={query.specialty ?? ""} className={field}>
              <option value="">{labels.anySpecialty}</option>
              {specialties.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <details className="group" open={Boolean(query.date || query.minPrice || query.maxPrice || query.minExperience || query.minRating || query.verified)}>
          <summary className="cursor-pointer list-none text-sm font-medium text-rose-ink underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
            {labels.more}
          </summary>
          <div className="mt-5 grid gap-5">
            <div className="grid gap-2">
              <label htmlFor="f-date" className={label}>
                {labels.date}
              </label>
              <input id="f-date" type="date" name="date" defaultValue={query.date ?? ""} className={field} />
            </div>
            <fieldset className="grid gap-2">
              <legend className={cn(label, "mb-2")}>{labels.price}</legend>
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="minPrice"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label={labels.minPrice}
                  placeholder={labels.minPrice}
                  defaultValue={query.minPrice ?? ""}
                  className={cn(field, "placeholder:text-ink-2/70")}
                />
                <input
                  name="maxPrice"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label={labels.maxPrice}
                  placeholder={labels.maxPrice}
                  defaultValue={query.maxPrice ?? ""}
                  className={cn(field, "placeholder:text-ink-2/70")}
                />
              </div>
            </fieldset>
            <div className="grid gap-2">
              <label htmlFor="f-exp" className={label}>
                {labels.experience}
              </label>
              <select id="f-exp" name="minExperience" defaultValue={query.minExperience ?? ""} className={field}>
                <option value="">{labels.anyExperience}</option>
                {[1, 3, 5, 10].map((y) => (
                  <option key={y} value={y}>
                    {y}+ {labels.years}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="f-rating" className={label}>
                {labels.rating}
              </label>
              <select id="f-rating" name="minRating" defaultValue={query.minRating ?? ""} className={field}>
                <option value="">{labels.anyRating}</option>
                {[4, 3].map((r) => (
                  <option key={r} value={r}>
                    {r}+ / 5
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="verified"
                value="1"
                defaultChecked={query.verified}
                className="size-4 accent-[var(--rose)]"
              />
              {labels.verified}
            </label>
          </div>
        </details>

        <div className="grid gap-2">
          <label htmlFor="f-sort" className={label}>
            {labels.sort}
          </label>
          <select id="f-sort" name="sort" defaultValue={query.sort ?? "relevance"} className={field}>
            {SORTS.filter((s) => s !== "distance" || coords).map((s) => (
              <option key={s} value={s}>
                {labels.sorts[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" className={buttonClass({ variant: "solid", size: "md" })}>
            {labels.apply}
          </button>
          <a href={action} className="text-sm text-ink-2 underline underline-offset-4 hover:text-rose-ink">
            {labels.reset}
          </a>
        </div>
      </form>
    </div>
  );
}
