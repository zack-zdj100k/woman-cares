import type { PagesDictionary } from "@/i18n/dictionaries/pages.fr";

/** Booking copy made serialisable for the client panel: counts and references use {n} and {ref}. */
export type BookingCopy = Omit<PagesDictionary["profile"]["book"], "left" | "done"> & { leftOne: string; leftMany: string; done: string };

export function bookingCopy(c: PagesDictionary["profile"]["book"]): BookingCopy {
  const { left, done, ...rest } = c;
  return { ...rest, leftOne: left(1), leftMany: left(999).replace("999", "{n}"), done: done("{ref}") };
}
