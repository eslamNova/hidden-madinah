import { Loader2 } from "lucide-react";

/** Instant feedback while an admin page (filters, journeys) loads on the server. */
export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <p className="flex items-center gap-2 text-lg font-medium text-muted">
        <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
        جارٍ التحميل…
      </p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface" />
      ))}
    </div>
  );
}
