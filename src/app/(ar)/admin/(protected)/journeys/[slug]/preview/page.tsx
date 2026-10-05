import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getJourney } from "@/lib/queries";
import { toPlayerJourney } from "@/lib/journey-view";
import { JourneyPlayer } from "@/components/journey/JourneyPlayer";

/**
 * The full visitor experience with UNREVIEWED content, for the reviewer only
 * (admin RLS sees pending rows). Nothing here is submitted or saved.
 */
export default async function JourneyPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTranslations("admin.journeys");
  const journey = await getJourney(decodeURIComponent(slug), { client: await createClient() });
  if (!journey) notFound();
  return (
    <div className="space-y-4">
      <p className="rounded-2xl border-[1.5px] border-accent bg-sand p-3 font-medium">{t("previewBanner")}</p>
      <h2 className="text-2xl">{journey.title_ar}</h2>
      <JourneyPlayer journey={toPlayerJourney(journey, "ar")} preview />
    </div>
  );
}
