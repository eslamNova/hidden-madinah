import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { PracticalEditor, type PracticalRow } from "@/components/admin/PracticalEditor";

export default async function AdminPracticalPage() {
  const t = await getTranslations("admin.practical");
  const supabase = await createClient();
  const { data } = await supabase
    .from("places")
    .select("id, slug, name_ar, is_published, visit_minutes, has_stairs, walking_effort, wheelchair_ok, opening_hours")
    .order("is_published", { ascending: false })
    .order("name_ar");

  const rows: PracticalRow[] = (data ?? []).map((p) => {
    const oh = p.opening_hours as { always?: boolean; daily?: [string, string][] } | null;
    return {
      id: p.id,
      slug: p.slug,
      name: p.name_ar,
      published: p.is_published,
      visit_minutes: p.visit_minutes,
      has_stairs: p.has_stairs,
      walking_effort: (p.walking_effort as PracticalRow["walking_effort"]) ?? null,
      wheelchair_ok: p.wheelchair_ok,
      hours: oh?.always ? "always" : oh?.daily?.[0] ? [oh.daily[0][0], oh.daily[0][1]] : null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl">{t("title")}</h2>
        <p className="text-muted">{t("intro")}</p>
      </div>
      <PracticalEditor rows={rows} />
    </div>
  );
}
