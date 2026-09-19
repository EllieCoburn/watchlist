import { Skeleton } from "@/components/ui/skeleton";

/** Calm skeleton shown while any /app page loads its data. */
export default function AppLoading() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Loading">
      <div className="space-y-3 border-b border-border pb-8">
        <Skeleton className="h-11 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="space-y-5 rounded-[var(--radius-lg)] border border-border/60 bg-surface p-6 shadow-[var(--shadow-card)]"
          >
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
