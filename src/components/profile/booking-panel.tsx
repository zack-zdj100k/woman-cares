"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { Clock, ImagePlus, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { BookingCopy } from "@/lib/booking-copy";
import { requestBookingAction, type BookingState } from "@/app/[locale]/booking/actions";
import { signOutAction } from "@/app/[locale]/auth/actions";
import { ArrowDot, buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Slot = { startAt: string; minute: number; remaining: number };
type Day = { date: string; weekday: number; slots: Slot[] };
export type BookableService = { id: string; name: string; duration: string; price: string };
type Viewer = "guest" | "client" | "unverified" | "other";


const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
type Photo = { id: string; file: File; url: string };

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`);

/**
 * Booking request: service, then a day from the next two weeks, then a time bar.
 * Times come from the professional's hours, closures, capacity and current requests (server).
 */
export function BookingPanel({
  locale,
  profileSlug,
  services,
  copy,
  viewer,
  signInHref,
}: {
  locale: Locale;
  profileSlug: string;
  services: BookableService[];
  copy: BookingCopy;
  viewer: Viewer;
  signInHref: string;
}) {
  const reduce = useReducedMotion();
  const storeKey = `wc:booking:${profileSlug}`;
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [data, setData] = useState<{ serviceId: string; days: Day[] } | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [startAt, setStartAt] = useState<string | null>(null);
  const [key] = useState(newKey);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photosRef = useRef<Photo[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);
  const router = useRouter();
  const [state, action, pending] = useActionState<BookingState, FormData>(async (prev, form) => {
    const result = await requestBookingAction(prev, form);
    if (result.status !== "done") return result;
    // The request exists now; the example photos follow it (a failed photo never loses the request).
    let photos = "";
    if (photosRef.current.length > 0) {
      let failed = false;
      for (const p of photosRef.current) {
        const body = new FormData();
        body.set("file", p.file);
        try {
          const res = await fetch(`/api/v1/bookings/${result.id}/references`, { method: "POST", body });
          if (!res.ok) failed = true;
        } catch {
          failed = true;
        }
      }
      photos = failed ? "failed" : "sent";
    }
    router.push(`/${locale}/booking/sent/${result.id}${photos ? `?photos=${photos}` : ""}`);
    return result;
  }, { status: "idle" });

  const addPhotos = (e: ChangeEvent<HTMLInputElement>) => {
    const next: Photo[] = [];
    let problem: string | null = null;
    for (const file of Array.from(e.target.files ?? [])) {
      if (photos.length + next.length >= MAX_PHOTOS) problem = "limit";
      else if (!PHOTO_TYPES.includes(file.type)) problem = "type";
      else if (file.size > MAX_PHOTO_BYTES) problem = "size";
      else next.push({ id: newKey(), file, url: URL.createObjectURL(file) });
    }
    e.target.value = "";
    setPhotoError(problem);
    if (next.length) setPhotos((cur) => [...cur, ...next]);
  };
  const removePhoto = (id: string) => {
    setPhotoError(null);
    setPhotos((cur) => {
      cur.filter((p) => p.id === id).forEach((p) => URL.revokeObjectURL(p.url));
      return cur.filter((p) => p.id !== id);
    });
  };

  // A choice saved before signing in comes back once.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey) ?? "null") as { serviceId: string; startAt: string } | null;
      if (saved && services.some((s) => s.id === saved.serviceId)) {
        sessionStorage.removeItem(storeKey);
        // Syncing once from browser storage (an external store) after hydration.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setServiceId(saved.serviceId);
        setStartAt(saved.startAt);
      }
    } catch {}
  }, [storeKey, services]);

  useEffect(() => {
    if (!serviceId) return;
    let alive = true;
    fetch(`/api/v1/profiles/${profileSlug}/availability?serviceId=${serviceId}&days=14`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json: { data: Day[] }) => alive && setData({ serviceId, days: json.data }))
      .catch(() => alive && setData({ serviceId, days: [] }));
    return () => {
      alive = false;
    };
  }, [profileSlug, serviceId, state.status]);

  const loading = !data || data.serviceId !== serviceId;
  const days = useMemo(() => (loading ? [] : data!.days), [loading, data]);
  const firstOpen = days.find((d) => d.slots.length > 0)?.date ?? null;
  const restoredDay = startAt ? days.find((d) => d.slots.some((s) => s.startAt === startAt))?.date : undefined;
  const activeDate = date && days.some((d) => d.date === date) ? date : (restoredDay ?? firstOpen);
  const day = days.find((d) => d.date === activeDate);
  const chosen = day?.slots.find((s) => s.startAt === startAt) ?? null;
  const service = services.find((s) => s.id === serviceId);

  const weekdayFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR", { weekday: "short", timeZone: "UTC" });
  const monthFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR", { month: "short", timeZone: "UTC" });
  const longFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const asDate = (d: string) => new Date(`${d}T12:00:00Z`);

  // Sent: the confirmation has its own page, so nothing here competes with it.
  if (state.status === "done") {
    return (
      <p role="status" className="py-10 text-center text-sm text-ink-2">
        {copy.sending}
      </p>
    );
  }

  if (services.length === 0) return <p className="text-ink-2">{copy.noServices}</p>;

  return (
    <form
      action={action}
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6"
    >
      <input type="hidden" name="profile" value={profileSlug} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={`/${locale}/profiles/${profileSlug}`} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="startAt" value={chosen?.startAt ?? ""} />
      <input type="hidden" name="key" value={key} />

      {/* 1. Service */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{copy.service}</legend>
        <div className="grid gap-2">
          {services.map((s) => (
            <label
              key={s.id}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm transition-[background-color,box-shadow,color] duration-300",
                s.id === serviceId ? "bg-[linear-gradient(180deg,#4a3540,#1d1116)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_10px_20px_-10px_rgb(29_17_22/0.7)]" : "bg-white/80 hover:bg-white",
              )}
            >
              <input
                type="radio"
                name="service-choice"
                value={s.id}
                checked={s.id === serviceId}
                onChange={() => {
                  setServiceId(s.id);
                  setStartAt(null);
                  setDate(null);
                }}
                className="sr-only"
              />
              <span>
                <span className="block font-medium">{s.name}</span>
                <span className={cn("block text-xs", s.id === serviceId ? "text-white/70" : "text-ink-2")}>{s.duration}</span>
              </span>
              <span className="shrink-0 text-end">{s.price}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* 2. Day */}
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-medium">{copy.day}</legend>
        {loading ? (
          <div className="flex gap-2 overflow-hidden" aria-label={copy.loading}>
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="h-[4.5rem] w-14 shrink-0 animate-pulse rounded-2xl bg-white/70" />
            ))}
          </div>
        ) : !firstOpen ? (
          <p className="text-sm text-ink-2">{copy.noDays}</p>
        ) : (
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {days.map((d) => {
              const on = d.date === activeDate;
              const empty = d.slots.length === 0;
              return (
                <button
                  key={d.date}
                  type="button"
                  disabled={empty}
                  aria-pressed={on}
                  aria-label={longFmt.format(asDate(d.date))}
                  onClick={() => {
                    setDate(d.date);
                    setStartAt(null);
                  }}
                  className={cn(
                    "grid w-14 shrink-0 snap-start justify-items-center gap-0.5 rounded-2xl py-2.5 text-xs transition-[background-color,color,box-shadow,transform] duration-300",
                    on
                      ? "bg-[linear-gradient(180deg,#4a3540,#1d1116)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_10px_20px_-10px_rgb(29_17_22/0.7)]"
                      : "bg-white/80 hover:-translate-y-0.5 hover:bg-white",
                    empty && "pointer-events-none opacity-40",
                  )}
                >
                  <span className="capitalize">{weekdayFmt.format(asDate(d.date)).replace(".", "")}</span>
                  <span className="text-lg font-medium leading-none">{Number(d.date.slice(8))}</span>
                  <span className="capitalize opacity-70">{monthFmt.format(asDate(d.date)).replace(".", "")}</span>
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      {/* 3. Time bars */}
      {!loading && firstOpen && (
        <fieldset>
          <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <Clock className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {copy.time}
          </legend>
          {!day || day.slots.length === 0 ? (
            <p className="text-sm text-ink-2">{copy.noSlots}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              <AnimatePresence initial={false}>
                {day.slots.map((s, i) => {
                  const on = s.startAt === startAt;
                  return (
                    <motion.button
                      key={s.startAt}
                      type="button"
                      aria-pressed={on}
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.015, 0.3), duration: 0.3 }}
                      onClick={() => setStartAt(s.startAt)}
                      className={cn(
                        "relative overflow-hidden rounded-full py-2.5 text-sm tabular-nums transition-[background-color,color,box-shadow] duration-300",
                        on
                          ? "bg-[linear-gradient(180deg,#c25a73,#8e3249)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_10px_20px_-10px_rgb(142_50_73/0.7)]"
                          : "bg-white/85 hover:bg-white",
                      )}
                      dir="ltr"
                    >
                      {hhmm(s.minute)}
                      {s.remaining > 1 && <span className={cn("block text-[0.65rem]", on ? "text-white/75" : "text-ink-2")}>{s.remaining === 1 ? copy.leftOne : copy.leftMany.replace("{n}", String(s.remaining))}</span>}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </fieldset>
      )}

      {/* 4. Note + send */}
      {chosen && service && day && (
        <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
          <div className="rounded-2xl bg-white/80 p-4 text-sm">
            <p className="font-medium">{copy.summary}</p>
            <p className="mt-1 text-ink-2">
              {service.name}, {longFmt.format(asDate(day.date))}, <span dir="ltr">{hhmm(chosen.minute)}</span>
            </p>
            <p className="mt-2 text-xs text-ink-2">{copy.pending}</p>
          </div>
          {(viewer === "client" || viewer === "unverified") && (
            <>
              <label className="grid gap-2 text-sm font-medium">
                {copy.note}
                <textarea name="note" rows={5} maxLength={1000} placeholder={copy.notePlaceholder} className="min-h-32 rounded-2xl border border-ink/15 bg-white/90 px-4 py-3 font-normal leading-relaxed focus:border-rose focus:outline-none" />
              </label>
              <div className="grid gap-2">
                <p className="text-sm font-medium">{copy.photos}</p>
                <p className="text-xs text-ink-2">{copy.photosHint}</p>
                <div className="flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <span key={p.id} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={`${copy.photos} ${i + 1}`} className="size-20 rounded-2xl border border-ink/10 object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(p.id)}
                        aria-label={copy.removePhoto}
                        className="absolute -end-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-ink text-white shadow"
                      >
                        <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <label className="grid size-20 cursor-pointer place-items-center rounded-2xl border border-dashed border-ink/25 bg-white/70 text-ink-2 transition-colors hover:bg-white focus-within:border-rose">
                      <ImagePlus className="size-6" strokeWidth={1.5} aria-hidden="true" />
                      <span className="sr-only">{copy.addPhoto}</span>
                      <input type="file" accept={PHOTO_TYPES.join(",")} multiple onChange={addPhotos} className="sr-only" />
                    </label>
                  )}
                </div>
                {photoError && (
                  <p role="alert" className="text-xs text-rose-ink">
                    {copy.photoErrors[photoError]}
                  </p>
                )}
              </div>
            </>
          )}
        </motion.div>
      )}

      {state.status === "error" && (
        <p role="alert" className="rounded-2xl bg-rose/10 px-4 py-3 text-sm text-rose-ink">
          {copy.errors[state.code] ?? copy.errors.generic}
        </p>
      )}

      {viewer === "guest" ? (
        <div className="grid gap-2">
          <Link
            href={signInHref}
            onClick={() => {
              try {
                if (chosen) sessionStorage.setItem(storeKey, JSON.stringify({ serviceId, startAt: chosen.startAt }));
              } catch {}
            }}
            className={buttonClass({ variant: "solid", size: "lg", className: "w-full pe-4" })}
          >
            {copy.signIn}
            <ArrowDot />
          </Link>
          <p className="text-center text-xs text-ink-2">{copy.signInNote}</p>
        </div>
      ) : viewer === "client" || viewer === "unverified" ? (
        <button type="submit" disabled={!chosen || pending} className={buttonClass({ variant: "solid", size: "lg", className: "w-full pe-4" })}>
          {pending ? copy.sending : copy.submit}
          <ArrowDot />
        </button>
      ) : (
        <div className="grid gap-3 rounded-2xl bg-white/80 p-4">
          <p className="text-sm leading-relaxed text-ink-2">{copy.clientOnly}</p>
          {/* Signs this account out and comes back here to sign in as a client; the chosen time is kept. */}
          <button
            type="submit"
            formAction={signOutAction}
            formNoValidate
            onClick={() => {
              try {
                if (chosen) sessionStorage.setItem(storeKey, JSON.stringify({ serviceId, startAt: chosen.startAt }));
              } catch {}
            }}
            className={buttonClass({ variant: "solid", size: "lg", className: "w-full pe-4" })}
          >
            {copy.switchAccount}
            <ArrowDot />
          </button>
        </div>
      )}
    </form>
  );
}
