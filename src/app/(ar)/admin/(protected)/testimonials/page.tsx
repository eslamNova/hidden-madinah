import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/database.types";
import { INTL_LOCALE } from "@/lib/i18n";
import { TestimonialReview, type ReviewTestimonial } from "@/components/admin/TestimonialReview";

const STATUSES: Enums<"review_status">[] = ["pending", "verified", "rejected"];

const WHEN = new Intl.DateTimeFormat(INTL_LOCALE.ar, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" });

/** «آراء الزوار»: visitors' testimonials wait here until approved for the home page. */
export default async function AdminTestimonialsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const t = await getTranslations("admin.testimonials");
  const sp = await searchParams;
  const status = (STATUSES as string[]).includes(sp.status ?? "") ? (sp.status as Enums<"review_status">) : "pending";
  const supabase = await createClient();

  const countOf = (s: Enums<"review_status">) =>
    supabase.from("testimonials").select("id", { count: "exact", head: true }).eq("status", s);
  const [list, journeys, ...counts] = await Promise.all([
    supabase
      .from("testimonials")
      .select("*")
      .eq("status", status)
      // The queue reads oldest first; published and rejected, newest first.
      .order("created_at", { ascending: status === "pending" })
      .limit(200),
    supabase.from("journeys").select("slug, title_ar"),
    ...STATUSES.map(countOf),
  ]);

  const titles = new Map((journeys.data ?? []).map((j) => [j.slug, j.title_ar]));
  const items: ReviewTestimonial[] = (list.data ?? []).map((r) => ({
    ...r,
    when: WHEN.format(new Date(r.created_at)),
    journeyTitle: r.journey_slug ? (titles.get(r.journey_slug) ?? null) : null,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl">{t("title")}</h2>
        <p className="text-muted">{t("intro")}</p>
      </div>

      <nav aria-label={t("statusNav")} className="flex flex-wrap gap-2">
        {STATUSES.map((st, i) => (
          <Link
            key={st}
            href={`/admin/testimonials?status=${st}`}
            aria-current={st === status ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${
              st === status ? "bg-basalt text-paper" : "bg-surface"
            }`}
          >
            {t(`status.${st}`)}
            {counts[i]?.count != null && <span className="ltr-nums ms-1 opacity-80">({counts[i].count})</span>}
          </Link>
        ))}
      </nav>

      {list.error ? (
        <p role="alert" className="rounded-2xl border border-ink/10 bg-surface p-4 font-semibold">
          {t("loadError")}
        </p>
      ) : (
        <TestimonialReview key={status} items={items} status={status} />
      )}
    </div>
  );
}
