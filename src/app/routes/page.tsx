import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getRoutes, getRouteWithStops } from "@/lib/queries";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("routes");
  return { title: t("title") };
}

export default async function RoutesPage() {
  const t = await getTranslations("routes");
  const routes = await getRoutes();
  const withStops = await Promise.all(
    routes.map(async (r) => {
      const full = await getRouteWithStops(r.id);
      return { ...r, stopCount: full?.stops.length ?? 0 };
    })
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="text-lg text-muted">{t("subtitle")}</p>
      </header>

      {withStops.length === 0 ? (
        <p className="rounded-2xl bg-surface p-8 text-center text-lg text-muted">
          {t("empty")}
        </p>
      ) : (
        <div className="space-y-4">
          {withStops.map((r) => (
            <Link
              key={r.id}
              href={`/routes/${r.id}`}
              className="block rounded-2xl border border-basalt/10 bg-surface p-5 shadow-sm"
            >
              <h2 className="text-2xl">{r.title_ar}</h2>
              {r.description_ar && (
                <p className="mt-2 text-lg leading-relaxed text-muted">
                  {r.description_ar}
                </p>
              )}
              <p className="mt-3 font-medium text-primary">
                {t("stopsCount", { count: r.stopCount })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}