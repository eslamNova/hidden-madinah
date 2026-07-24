import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { getPublishedPlaces, getRoutes, getRouteWithStops } from "@/lib/queries";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/maps";
import { CategoryIcon } from "@/components/CategoryIcon";
import { PlaceCard, toPlaceCardData } from "@/components/place/PlaceCard";
import { NearestPlaces, type NearestPlaceInput } from "@/components/place/NearestPlaces";

export const revalidate = 86400;

export default async function HomePage() {
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");
  const tPlaces = await getTranslations("places");
  const tRoutes = await getTranslations("routes");

  const places = await getPublishedPlaces();
  const featured = places.filter((p) => p.featured).slice(0, 4);
  const routes = await getRoutes();
  const routesWithStops = await Promise.all(
    routes.map(async (r) => {
      const full = await getRouteWithStops(r.id);
      return { ...r, stopCount: full?.stops.length ?? 0 };
    })
  );

  const nearestInput: NearestPlaceInput[] = places
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({
      slug: p.slug,
      name_ar: p.name_ar,
      category: p.category,
      lat: Number(p.lat),
      lng: Number(p.lng),
    }));

  const categoryCounts = new Map<string, number>();
  for (const p of places) {
    categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
  }

  return (
    <div className="space-y-12 pb-8">
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-dark to-primary px-4 py-14 text-surface">
        <div className="mx-auto max-w-3xl space-y-5 text-center">
          <p className="font-wordmark text-xl text-accent">{tCommon("siteName")}</p>
          <h1 className="text-4xl leading-snug sm:text-5xl">{t("heroTitle")}</h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-surface/90">
            {t("heroSubtitle")}
          </p>
          <div className="pt-2">
            <Link
              href="/places"
              className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-surface px-10 text-lg font-semibold text-primary shadow-md"
            >
              {t("heroCta")}
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-12 px-4">
        {/* Featured */}
        {featured.length > 0 && (
          <section aria-label={t("featuredTitle")} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl">{t("featuredTitle")}</h2>
              <Link
                href="/places"
                className="flex min-h-12 items-center gap-1 font-medium text-primary"
              >
                {tCommon("viewAll")}
                <ChevronLeft aria-hidden="true" className="h-5 w-5" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {featured.map((p) => (
                <PlaceCard key={p.slug} place={toPlaceCardData(p)} />
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        <section aria-label={t("categoriesTitle")} className="space-y-4">
          <h2 className="text-2xl">{t("categoriesTitle")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CATEGORY_ORDER.filter((c) => c !== "other").map((c) => (
              <Link
                key={c}
                href={`/places?category=${c}`}
                className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-basalt/10 bg-surface p-4 text-center shadow-sm"
              >
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${CATEGORY_META[c].color}1f` }}
                >
                  <CategoryIcon category={c} className="h-7 w-7" />
                </span>
                <span className="text-lg font-semibold">{CATEGORY_META[c].pluralAr}</span>
                <span className="text-sm text-muted">
                  {tPlaces("count", { count: categoryCounts.get(c) ?? 0 })}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Nearest (geolocation, client) */}
        <NearestPlaces places={nearestInput} />

        {/* Curated routes */}
        {routesWithStops.length > 0 && (
          <section aria-label={t("routesTitle")} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl">{t("routesTitle")}</h2>
              <Link
                href="/routes"
                className="flex min-h-12 items-center gap-1 font-medium text-primary"
              >
                {tCommon("viewAll")}
                <ChevronLeft aria-hidden="true" className="h-5 w-5" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {routesWithStops.map((r) => (
                <Link
                  key={r.id}
                  href={`/routes/${r.id}`}
                  className="block rounded-2xl border border-basalt/10 bg-surface p-5 shadow-sm"
                >
                  <h3 className="text-xl">{r.title_ar}</h3>
                  {r.description_ar && (
                    <p className="mt-2 line-clamp-2 text-base leading-relaxed text-muted">
                      {r.description_ar}
                    </p>
                  )}
                  <p className="mt-3 text-sm font-medium text-primary">
                    {tRoutes("stopsCount", { count: r.stopCount })}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}