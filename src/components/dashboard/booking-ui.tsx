import type { Locale } from "@/i18n/config";
import { formatDate, formatDzd } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

/** Server-rendered pieces shared by the client and professional booking pages. */

const tone: Record<string, "success" | "warning" | "destructive" | "rose" | "outline" | "secondary"> = {
  PENDING: "warning",
  RESCHEDULE_PROPOSED: "rose",
  ACCEPTED: "success",
  COMPLETED: "secondary",
  NO_SHOW: "destructive",
  REJECTED: "outline",
  CANCELLED_BY_CLIENT: "outline",
  CANCELLED_BY_PROVIDER: "outline",
  EXPIRED: "outline",
};

export function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  return <Badge variant={tone[status] ?? "outline"}>{labels[status] ?? status}</Badge>;
}

export function priceRange(min: { toString(): string }, max: { toString(): string } | null, locale: Locale) {
  const a = min.toString();
  const b = max?.toString();
  return b && Number(b) !== Number(a) ? `${formatDzd(a, locale)} - ${formatDzd(b, locale)}` : formatDzd(a, locale);
}

export const when = (d: Date, locale: Locale) => formatDate(d, locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const whenLong = (d: Date, locale: Locale) => formatDate(d, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function BookingHistory({
  rows,
  locale,
  statuses,
  by,
  clientId,
}: {
  rows: { id: string; toStatus: string; reason: string | null; createdAt: Date; actorId: string | null }[];
  locale: Locale;
  statuses: Record<string, string>;
  by: { client: string; provider: string; system: string };
  clientId: string | null;
}) {
  return (
    <ol className="relative grid gap-4 border-s border-border ps-5">
      {rows.map((h) => (
        <li key={h.id} className="relative text-sm">
          <span className="absolute -start-[1.6rem] top-1.5 size-2.5 rounded-full bg-chart-1" aria-hidden="true" />
          <p className="font-medium">{statuses[h.toStatus] ?? h.toStatus}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(h.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })} · {h.actorId === null ? by.system : h.actorId === clientId ? by.client : by.provider}
          </p>
          {h.reason && h.reason !== "proposal declined" && h.reason !== "no answer" && <p className="mt-1 text-muted-foreground">{h.reason}</p>}
        </li>
      ))}
    </ol>
  );
}
