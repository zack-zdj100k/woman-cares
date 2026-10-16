import type { DashboardDictionary } from "@/i18n/dictionaries/dashboard.fr";

/** The booking dictionary minus its functions, so it can cross into client components. */
export function bookingLabels(b: DashboardDictionary["bookings"]) {
  const { reviewStars, minutes, ...plain } = b;
  void minutes;
  return { ...plain, stars: [1, 2, 3, 4, 5].map(reviewStars) };
}

export type BookingLabels = ReturnType<typeof bookingLabels>;
