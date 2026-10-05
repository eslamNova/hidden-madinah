"use server";

import { revalidateBoth } from "@/lib/revalidate";
import { requireAdmin, type ActionResult } from "@/lib/admin-auth";
import type { Enums, TablesUpdate } from "@/lib/database.types";

export type ClaimReviewInput = {
  id: number;
  status: Enums<"review_status">;
  text_ar?: string;
  reviewer_note?: string | null;
  content_level?: Enums<"content_level">;
};

/** Approve, reject or edit one claim. Edits keep the claim's citation. */
export async function reviewClaimAction(input: ClaimReviewInput): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const patch: TablesUpdate<"claims"> = {
      status: input.status,
      reviewed_at: input.status === "pending" ? null : new Date().toISOString(),
      // The English text is shown beside the Arabic and approved with it.
      en_reviewed: input.status === "verified",
    };
    if (input.text_ar !== undefined) {
      const text = input.text_ar.trim();
      if (!text) return { ok: false, error: "empty" };
      patch.text_ar = text;
    }
    if (input.reviewer_note !== undefined) patch.reviewer_note = input.reviewer_note?.trim() || null;
    if (input.content_level) patch.content_level = input.content_level;

    const { error } = await supabase.from("claims").update(patch).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    // Verified claims feed place pages, journeys and the guide: refresh all.
    revalidateBoth("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}

/** Approve several claims at once (the reviewer ticks them first). */
export async function approveClaimsAction(ids: number[]): Promise<ActionResult<{ count: number }>> {
  try {
    const supabase = await requireAdmin();
    if (ids.length === 0) return { ok: true, data: { count: 0 } };
    const { error } = await supabase
      .from("claims")
      .update({ status: "verified", reviewed_at: new Date().toISOString(), en_reviewed: true })
      .in("id", ids);
    if (error) return { ok: false, error: error.message };
    revalidateBoth("/", "layout");
    return { ok: true, data: { count: ids.length } };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}
