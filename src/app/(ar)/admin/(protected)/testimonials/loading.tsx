import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

/** Instant feedback while the testimonials queue (or another status tab) loads. */
export default function AdminTestimonialsLoading() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <p className="flex items-center gap-2 text-lg font-medium text-muted">
        <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
        {t("loading")}
      </p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-36 animate-pulse rounded-2xl bg-surface" />
      ))}
    </div>
  );
}
