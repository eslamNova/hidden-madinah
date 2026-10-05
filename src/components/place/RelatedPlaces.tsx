import { getTranslations } from "next-intl/server";
import type { Lang } from "@/lib/i18n";
import { getPlacesBySlugs } from "@/lib/queries";
import { PlaceCard, toPlaceCardData } from "@/components/place/PlaceCard";

/**
 * "أماكن خفية قريبة" — renders only PUBLISHED related places; hides itself
 * entirely while all of them are still drafts (e.g. Quba's five stubs).
 */
export async function RelatedPlaces({ slugs, lang }: { slugs: string[]; lang: Lang }) {
  if (slugs.length === 0) return null;
  const places = await getPlacesBySlugs(slugs, lang);
  if (places.length === 0) return null;
  const t = await getTranslations("place");

  return (
    <section aria-label={t("relatedTitle")}>
      <h2 className="mb-4 text-2xl">{t("relatedTitle")}</h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {places.map((p) => (
          <PlaceCard key={p.slug} place={toPlaceCardData(p)} compact />
        ))}
      </div>
    </section>
  );
}
