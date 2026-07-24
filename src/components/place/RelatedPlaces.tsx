import { getTranslations } from "next-intl/server";
import { getPlacesBySlugs } from "@/lib/queries";
import { PlaceCard, toPlaceCardData } from "@/components/place/PlaceCard";

/**
 * "أماكن خفية قريبة" — renders only PUBLISHED related places; hides itself
 * entirely while all of them are still drafts (e.g. Quba's five stubs).
 */
export async function RelatedPlaces({ slugs }: { slugs: string[] }) {
  if (slugs.length === 0) return null;
  const places = await getPlacesBySlugs(slugs);
  if (places.length === 0) return null;
  const t = await getTranslations("place");

  return (
    <section aria-label={t("relatedTitle")}>
      <h2 className="mb-4 text-2xl">{t("relatedTitle")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {places.map((p) => (
          <PlaceCard key={p.slug} place={toPlaceCardData(p)} compact />
        ))}
      </div>
    </section>
  );
}