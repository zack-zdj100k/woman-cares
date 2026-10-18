import type { PagesDictionary } from "@/i18n/dictionaries/pages.fr";

/** Booking copy made serialisable for the client panel: counts use {n}. */
export type BookingCopy = Omit<PagesDictionary["profile"]["book"], "left"> & { leftOne: string; leftMany: string };

export function bookingCopy(c: PagesDictionary["profile"]["book"]): BookingCopy {
  const { left, ...rest } = c;
  return { ...rest, leftOne: left(1), leftMany: left(999).replace("999", "{n}") };
}
