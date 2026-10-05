import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HERO_IMAGES } from "@/lib/hero-images";
import { getPlannerPlaces } from "@/lib/queries";
import { PageHero } from "@/components/layout/PageHero";
import { Planner } from "@/components/planner/Planner";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("plan");
  return { title: t("title"), description: t("subtitle") };
}

export default async function PlanPage() {
  const t = await getTranslations("plan");
  const places = await getPlannerPlaces();
  const day = Math.floor(Date.now() / 86_400_000);
  return (
    <>
      <PageHero photo={HERO_IMAGES[(day + 4) % HERO_IMAGES.length] ?? null} title={t("title")} subtitle={t("subtitle")} />
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-8">
        <Planner places={places} />
      </div>
    </>
  );
}
