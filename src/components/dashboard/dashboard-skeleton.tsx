export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-[1100px] px-5 pt-16 pb-24 sm:px-8" aria-hidden="true">
      <div className="h-14 w-72 animate-pulse rounded-2xl bg-surface-2" />
      <div className="mt-6 h-4 w-full max-w-[36rem] animate-pulse rounded-full bg-surface-2" />
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-(--radius-media) bg-surface" />
        ))}
      </div>
    </div>
  );
}
