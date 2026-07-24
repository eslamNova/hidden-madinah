import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { PlaceForm } from "@/components/admin/PlaceForm";

export default async function EditPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("admin");
  const supabase = await createClient();

  const { data: place } = await supabase
    .from("places")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!place) notFound();

  const { data: media } = await supabase
    .from("media")
    .select("*")
    .eq("place_id", id)
    .order("sort_order");

  return (
    <div className="space-y-6">
      <h2 className="text-xl">
        {t("editPlace")}: {place.name_ar}
      </h2>
      {place.admin_notes_ar && (
        <div className="rounded-2xl border-[1.5px] border-accent bg-sand p-4">
          <h3 className="mb-1 font-semibold">{t("reviewNotes")}</h3>
          <p className="whitespace-pre-line leading-relaxed">{place.admin_notes_ar}</p>
        </div>
      )}
      <PlaceForm place={place} media={media ?? []} />
    </div>
  );
}