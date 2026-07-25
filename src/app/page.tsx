import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, Compass, Route as RouteIcon } from "lucide-react";
import { getPublishedPlaces, getRoutesWithStops } from "@/lib/queries";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/maps";
import { CategoryIcon } from "@/components/CategoryIcon";
import { PlaceCard, toPlaceCardData } from "@/components/place/PlaceCard";
import { PlaceImage, PlaceholderImage } from "@/components/place/PlaceImage";
import { NearestPlaces, type NearestPlaceInput } from "@/components/place/NearestPlaces";

export const revalidate = 86400;

function SectionHeading({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl">{title}</h2>
        <span aria-hidden="true" className="gold-rule mt-2 block h-px w-16" />
      </div>
      {href && linkLabel && (
        <Link href={href} className="flex min-h-12 items-center gap-1 font-medium text-primary">
          {linkLabel}
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");
  const tPlaces = await getTranslations("places");
  const tRoutes = await getTranslations("routes");

  const places = await getPublishedPlaces();
  const routes = await getRoutesWithStops();

  const featured = places.filter((p) => p.featured);
  // The hero photo comes from the first featured place that actually has one.
  const heroPlace = featured.find((p) => p.media.some((m) => m.type === "photo")) ?? featured[0];
  const heroPhoto = heroPlace?.media.find((m) => m.type === "photo") ?? null;
  const heroRest = featured.filter((p) => p.slug !== heroPlace?.slug).slice(0, 4);

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
  // A representative photo per category, so the category tiles are imagery too.
  const categoryPhoto = new Map<string, { url: string; width: number; height: number }>();
  for (const p of places) {
    if (categoryPhoto.has(p.category)) continue;
    const photo = p.media.find((m) => m.type === "photo");
    if (photo?.thumb_url && photo.width && photo.height) {
      categoryPhoto.set(p.category, {
        url: photo.thumb_url,
        width: photo.width,
        height: photo.height,
      });
    }
  }

  return (
    <div className="space-y-14 pb-10">
      {/* Cinematic hero — a real photograph carries the brand. */}
      <section className="relative min-h-[78dvh] overflow-hidden bg-basalt">
        {heroPhoto ? (
          <PlaceImage
            media={heroPhoto}
            alt={heroPlace!.name_ar}
            sizes="100vw"
            priority
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <PlaceholderImage
            category={heroPlace?.category ?? "mosque"}
            className="absolute inset-0 h-full w-full"
            iconClassName="h-24 w-24"
          />
        )}
        <div aria-hidden="true" className="warm-wash absolute inset-0" />
        <div aria-hidden="true" className="scrim-hero absolute inset-0" />

        <div className="relative flex min-h-[78dvh] flex-col justify-end px-5 pb-12 pt-24">
          <div className="mx-auto w-full max-w-3xl space-y-5">
            <p className="font-wordmark text-xl text-accent">{tCommon("siteName")}</p>
            <h1 className="text-4xl leading-tight text-surface sm:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-surface/85">
              {t("heroSubtitle")}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/places"
                className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-surface px-8 text-lg font-semibold text-primary-dark shadow-lg"
              >
                <Compass aria-hidden="true" className="h-6 w-6" />
                {t("heroCta")}
              </Link>
              <Link
                href="/map"
                className="flex min-h-14 items-center justify-center rounded-2xl border-[1.5px] border-surface/70 px-8 text-lg font-semibold text-surface backdrop-blur-sm"
              >
                {t("heroMapCta")}
              </Link>
            </div>
            {heroPlace && (
              <p className="pt-2 text-sm text-surface/70">
                {t("heroCredit", { name: heroPlace.name_ar })}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-14 px-4">
        {/* Featured gallery */}
        {heroRest.length > 0 && (
          <section aria-label={t("featuredTitle")}>
            <SectionHeading
              title={t("featuredTitle")}
              href="/places"
              linkLabel={tCommon("viewAll")}
            />
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {heroRest.map((p) => (
                <PlaceCard key={p.slug} place={toPlaceCardData(p)} />
              ))}
            </div>
          </section>
        )}

        {/* Categories as image tiles */}
        <section aria-label={t("categoriesTitle")}>
          <SectionHeading title={t("categoriesTitle")} />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {CATEGORY_ORDER.filter((c) => c !== "other").map((c) => {
              const photo = categoryPhoto.get(c);
              return (
                <Link
                  key={c}
                  href={`/places?category=${c}`}
                  className="card-lift relative block overflow-hidden rounded-2xl bg-basalt shadow-md"
                >
                  {photo ? (
                    <PlaceImage
                      media={photo}
                      alt=""
                      sizes="(max-width: 640px) 45vw, 260px"
                      className="aspect-[3/2] w-full object-cover"
                    />
                  ) : (
                    <PlaceholderImage category={c} className="aspect-[3/2] w-full" />
                  )}
                  <div aria-hidden="true" className="scrim absolute inset-0" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-4">
                    <CategoryIcon category={c} className="h-6 w-6 shrink-0 text-surface" />
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-semibold text-surface">
                        {CATEGORY_META[c].pluralAr}
                      </span>
                      <span className="block text-sm text-surface/75">
                        {tPlaces("count", { count: categoryCounts.get(c) ?? 0 })}
                      </span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Nearest (geolocation, client) */}
        <NearestPlaces places={nearestInput} />

        {/* Curated routes */}
        {routes.length > 0 && (
          <section aria-label={t("routesTitle")}>
            <SectionHeading
              title={t("routesTitle")}
              href="/routes"
              linkLabel={tCommon("viewAll")}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {routes.map((r) => {
                const cover = r.stops
                  .flatMap((s) => s.media.filter((m) => m.type === "photo"))
                  .find((m) => m.thumb_url && m.width && m.height);
                return (
                  <Link
                    key={r.id}
                    href={`/routes/${r.id}`}
                    className="card-lift relative block overflow-hidden rounded-2xl bg-basalt shadow-md"
                  >
                    {cover ? (
                      <PlaceImage
                        media={{
                          url: cover.thumb_url!,
                          width: cover.width,
                          height: cover.height,
                        }}
                        alt=""
                        sizes="(max-width: 640px) 92vw, 420px"
                        className="aspect-[16/9] w-full object-cover"
                      />
                    ) : (
                      <PlaceholderImage
                        category={r.stops[0]?.category ?? "mosque"}
                        className="aspect-[16/9] w-full"
                      />
                    )}
                    <div aria-hidden="true" className="scrim absolute inset-0" />
                    <div className="absolute inset-x-0 bottom-0 space-y-1 p-5">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-accent">
                        <RouteIcon aria-hidden="true" className="h-4 w-4" />
                        {tRoutes("stopsCount", { count: r.stops.length })}
                      </span>
                      <h3 className="text-2xl text-surface">{r.title_ar}</h3>
                      {r.description_ar && (
                        <p className="line-clamp-2 text-base leading-relaxed text-surface/80">
                          {r.description_ar}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}