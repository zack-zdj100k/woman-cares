/** Example photos a client attached to her request (private: served by an authorised route). */
export function ReferencePhotos({ bookingId, ids, label }: { bookingId: string; ids: string[]; label: string }) {
  if (ids.length === 0) return null;
  return (
    <div className="sm:col-span-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <ul className="mt-2 flex flex-wrap gap-3">
        {ids.map((id, i) => {
          const src = `/api/v1/bookings/${bookingId}/references/${id}`;
          return (
            <li key={id}>
              <a href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${label} ${i + 1}`} width={160} height={160} loading="lazy" className="size-32 object-cover sm:size-40" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
