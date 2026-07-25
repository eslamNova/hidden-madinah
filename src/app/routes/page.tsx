import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Route as RouteIcon } from "lucide-react";
import { getRoutesWithStops } from "@/lib/queries";
import { PlaceImage, PlaceholderImage } from "@/components/place/PlaceImage";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("routes");
  return { title: t("title") };
}

export default async function RoutesPage() {
  const t = await getTranslations("routes");
  const routes = await getRoutesWithStops();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl">{t("title")}</h1>
        <span aria-hidden="true" className="gold-rule block h-px w-20" />
        <p className="text-lg text-muted">{t("subtitle")}</p>
      </header>

      {routes.length === 0 ? (
        <p className="rounded-2xl bg-surface p-8 text-center text-lg text-muted">
          {t("empty")}
        </p>
      ) : (
        <div className="space-y-5">
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
                    media={{ url: cover.thumb_url!, width: cover.width, height: cover.height }}
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
                  <h2 className="text-2xl text-surface">{r.title_ar}</h2>
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
      )}
    </div>
  );
}
