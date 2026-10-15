import type { createClient } from "@/lib/supabase/server";
import type { EditorOption } from "@/components/admin/ArticleEditor";

/**
 * Places and journeys an article can link to, for the editor's pickers —
 * drafts included (marked), so a link to a place that is not public yet can be
 * prepared; public pages show published ones only.
 */
export async function loadEditorOptions(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [places, journeys] = await Promise.all([
    supabase.from("places").select("slug, name_ar, is_published").order("name_ar"),
    supabase.from("journeys").select("slug, title_ar, is_published").order("sort_order"),
  ]);
  return {
    places: (places.data ?? []).map((p): EditorOption => ({ slug: p.slug, label: p.name_ar, published: p.is_published })),
    // A fresh environment without migration 006 simply has no journeys to offer.
    journeys: (journeys.data ?? []).map((j): EditorOption => ({ slug: j.slug, label: j.title_ar, published: j.is_published })),
  };
}
