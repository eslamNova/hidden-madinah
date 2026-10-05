import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getJourney } from "@/lib/queries";
import { JourneyReview, type ReviewJourney } from "@/components/admin/JourneyReview";

export default async function AdminJourneysPage({
  searchParams,
}: {
  searchParams: Promise<{ j?: string }>;
}) {
  const t = await getTranslations("admin.journeys");
  const supabase = await createClient();
  const { data: list } = await supabase.from("journeys").select("slug, title_ar, is_published").order("sort_order");
  const selected = (await searchParams).j ?? list?.[0]?.slug;
  const journey = selected ? await getJourney(selected, { client: supabase }) : null;

  const review: ReviewJourney | null = journey && {
    slug: journey.slug,
    title: journey.title_ar,
    published: journey.is_published,
    intro: journey.intro_ar,
    stops: journey.stops.map((s) => ({
      id: s.id,
      order: s.sort_order,
      title: s.title_ar ?? s.place?.name_ar ?? "",
      status: s.status,
      script: s.script_ar,
      scriptEn: s.script_en,
      kids: s.script_kids_ar,
      human: s.human_moment_ar,
      reflection: s.reflection_ar,
      claims: s.claim_ids.map((id) => {
        const c = journey.claims.get(id);
        return { id, text: c?.text_ar ?? "?", status: c?.status ?? "pending", level: c?.content_level ?? "?", vol: c?.vol ?? null, page: c?.page ?? null };
      }),
    })),
    quiz: journey.quiz.map((q) => ({
      id: q.id,
      question: q.question_ar,
      options: q.options_ar,
      answer: q.answer_index,
      status: q.status,
    })),
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl">{t("title")}</h2>
        <p className="text-muted">{t("intro")}</p>
      </div>
      <nav className="flex flex-wrap gap-2">
        {(list ?? []).map((j) => (
          <Link
            key={j.slug}
            href={`/admin/journeys?j=${j.slug}`}
            aria-current={j.slug === selected ? "page" : undefined}
            className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium ${
              j.slug === selected ? "border-primary bg-primary text-paper" : "border-ink/15 bg-surface"
            }`}
          >
            {j.title_ar} {j.is_published ? "✓" : ""}
          </Link>
        ))}
      </nav>
      {review ? <JourneyReview journey={review} /> : <p>{t("none")}</p>}
    </div>
  );
}
