import { getTranslations } from "next-intl/server";
import { PlaceForm } from "@/components/admin/PlaceForm";

export default async function NewPlacePage() {
  const t = await getTranslations("admin");
  return (
    <div className="space-y-6">
      <h2 className="text-xl">{t("newPlace")}</h2>
      <PlaceForm place={null} media={[]} />
    </div>
  );
}