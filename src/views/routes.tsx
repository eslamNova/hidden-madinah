import type { Metadata } from "next";
import Link from "@/components/i18n/Link";
import { getTranslations } from "next-intl/server";
import { Route as RouteIcon } from "lucide-react";
import { coverImage, stripVerify } from "@/lib/content";
import { HERO_IMAGES } from "@/lib/hero-images";
import { languageAlternates, type Lang } from "@/lib/i18n";
import { getRoutesWithStops } from "@/lib/queries";
import { PageHero } from "@/components/layout/PageHero";
import { PlaceImage, PlaceholderImage } from "@/components/place/PlaceImage";

/** /routes and /en/routes. The route files set the request locale before rendering. */
export async function routesMetadata(lang: Lang): Promise<Metadata> {
  const t = await getTranslations("routes");
  return { title: t("title"), alternates: languageAlternates("/routes", lang) };
}

export async function RoutesView({ lang }: { lang: Lang }) {
  const t = await getTranslations("routes");
  const routes = await getRoutesWithStops(lang);

  // Header photo: the first route's cover, else the daily Nabawi frame.
  const day = Math.floor(Date.now() / 86_400_000);
  const heroPhoto =
    coverImage(routes[0]?.stops.flatMap((s) => s.media) ?? []) ??
    HERO_IMAGES[(day + 3) % HERO_IMAGES.length] ??
    null;

  return (
    <>
      <PageHero photo={heroPhoto} title={t("title")} subtitle={t("subtitle")} />
      <div className="mx-auto max-w-3xl space-y-8 px-4 pb-8 pt-8">
      {routes.length === 0 ? (
        <p className="card-elevated p-8 text-center text-lg text-muted">
          {t("empty")}
        </p>
      ) : (
        <div className="space-y-5">
          {routes.map((r) => {
            const cover = coverImage(r.stops.flatMap((s) => s.media));
            const description = stripVerify(r.description_ar);
            return (
              <Link
                key={r.id}
                href={`/routes/${encodeURIComponent(r.slug)}`}
                className="card-lift relative block overflow-hidden rounded-2xl bg-basalt shadow-md"
              >
                {cover ? (
                  <PlaceImage
                    media={cover}
                    alt=""
                    sizes="(max-width: 768px) 92vw, 720px"
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
                    {t("stopsCount", { count: r.stops.length })}
                  </span>
                  <h2 className="text-2xl text-paper">{r.title_ar}</h2>
                  {description && (
                    <p className="line-clamp-2 text-base leading-relaxed text-paper/80">
                      {description}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      </div>
    </>
  );
}
