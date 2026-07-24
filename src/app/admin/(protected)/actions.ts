"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { TransportOption } from "@/lib/content";
import type { Enums, Json, TablesInsert } from "@/lib/database.types";
import { IMAGE_VARIANT_WIDTHS, MEDIA_BUCKET } from "@/lib/media-spec";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

async function requireAdmin() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) throw new Error("unauthorized");
  return supabase;
}

function revalidatePublic(slug?: string | null) {
  revalidatePath("/");
  revalidatePath("/places");
  revalidatePath("/map");
  revalidatePath("/routes");
  if (slug) revalidatePath(`/places/${slug}`);
}

/** Storage object path ("places/…") from a public URL, or null for embeds. */
function storagePathFromUrl(url: string): string | null {
  const marker = `/object/public/${MEDIA_BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : decodeURIComponent(url.slice(idx + marker.length));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export type PlaceFormInput = {
  id?: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  category: Enums<"place_category">;
  is_published: boolean;
  featured: boolean;
  summary_ar: string | null;
  story_ar: string | null;
  virtue_ar: string | null;
  featured_quote_ar: string | null;
  featured_quote_source_ar: string | null;
  how_to_get_there_ar: string | null;
  transport_options: TransportOption[];
  transport_note_ar: string | null;
  best_time_ar: string | null;
  open_status_ar: string | null;
  visiting_tips_ar: string | null;
  google_maps_url: string | null;
  related_place_slugs: string[];
  admin_notes_ar: string | null;
  lat: number | null;
  lng: number | null;
  distance_from_prophets_mosque_km: number | null;
  drive_time_from_haram_min: number | null;
};

export async function savePlaceAction(
  input: PlaceFormInput
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const supabase = await requireAdmin();
    if (!/^[a-z0-9-]+$/.test(input.slug)) return { ok: false, error: "slug" };
    if (!input.name_ar.trim()) return { ok: false, error: "name_ar" };

    const { id, transport_options, ...fields } = input;
    const row = {
      ...fields,
      transport_options:
        transport_options.length > 0
          ? (transport_options as unknown as Json)
          : null,
    };

    const query = id
      ? supabase.from("places").update(row).eq("id", id).select("id, slug").single()
      : supabase.from("places").insert(row).select("id, slug").single();
    const { data, error } = await query;
    if (error || !data) return { ok: false, error: error?.message ?? "save" };

    revalidatePublic(data.slug);
    return { ok: true, data: { id: data.id, slug: data.slug } };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}

export async function setPublishedAction(
  id: string,
  isPublished: boolean
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { data, error } = await supabase
      .from("places")
      .update({ is_published: isPublished })
      .eq("id", id)
      .select("slug")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "publish" };
    revalidatePublic(data.slug);
    return { ok: true };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}

export async function deletePlaceAction(id: string): Promise<never | ActionResult> {
  let deleted = false;
  try {
    const supabase = await requireAdmin();

    // Remove every storage object under places/{id}/ first.
    const prefix = `places/${id}`;
    for (;;) {
      const { data: objects, error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .list(prefix, { limit: 100 });
      if (error || !objects || objects.length === 0) break;
      await supabase.storage
        .from(MEDIA_BUCKET)
        .remove(objects.map((o) => `${prefix}/${o.name}`));
      if (objects.length < 100) break;
    }

    const { data, error } = await supabase
      .from("places")
      .delete()
      .eq("id", id)
      .select("slug")
      .single();
    if (error) return { ok: false, error: error.message };
    revalidatePublic(data?.slug);
    deleted = true;
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  if (deleted) redirect("/admin");
  return { ok: true };
}

export type MediaRowInput = Pick<
  TablesInsert<"media">,
  | "place_id"
  | "type"
  | "provider"
  | "url"
  | "thumb_url"
  | "width"
  | "height"
  | "duration_seconds"
  | "sort_order"
>;

export async function saveMediaRowAction(
  row: MediaRowInput,
  placeSlug: string
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("media").insert(row);
    if (error) return { ok: false, error: error.message };
    revalidatePublic(placeSlug);
    return { ok: true };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}

export async function updateMediaCaptionAction(
  id: string,
  caption: string,
  placeSlug: string
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from("media")
      .update({ caption_ar: caption.trim() || null })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePublic(placeSlug);
    return { ok: true };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}

export async function reorderMediaAction(
  orderedIds: string[],
  placeSlug: string
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase
        .from("media")
        .update({ sort_order: i })
        .eq("id", orderedIds[i]);
      if (error) return { ok: false, error: error.message };
    }
    revalidatePublic(placeSlug);
    return { ok: true };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}

export async function deleteMediaAction(
  id: string,
  placeSlug: string
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { data: row, error: fetchError } = await supabase
      .from("media")
      .select("url, thumb_url, type, provider")
      .eq("id", id)
      .single();
    if (fetchError || !row) return { ok: false, error: fetchError?.message ?? "missing" };

    if (row.provider === "storage") {
      const paths = new Set<string>();
      const mainPath = storagePathFromUrl(row.url);
      if (mainPath) {
        paths.add(mainPath);
        // Photos have sibling variants: {base}-{w}.{webp|jpg}.
        const match = mainPath.match(/^(.*)-(400|800|1600)\.(webp|jpg)$/);
        if (match) {
          for (const w of IMAGE_VARIANT_WIDTHS) {
            paths.add(`${match[1]}-${w}.webp`);
            paths.add(`${match[1]}-${w}.jpg`);
          }
        }
      }
      const thumbPath = row.thumb_url ? storagePathFromUrl(row.thumb_url) : null;
      if (thumbPath) paths.add(thumbPath);
      if (paths.size > 0) {
        await supabase.storage.from(MEDIA_BUCKET).remove([...paths]);
      }
    }

    const { error } = await supabase.from("media").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePublic(placeSlug);
    return { ok: true };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}