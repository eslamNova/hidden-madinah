"use server";

import { revalidateBoth } from "@/lib/revalidate";
import { requireAdmin, type ActionResult } from "@/lib/admin-auth";
import type { Enums } from "@/lib/database.types";

const STATUSES: Enums<"review_status">[] = ["pending", "verified", "rejected"];

/**
 * Approve («اعتماد» → verified), reject (→ rejected) or return one
 * testimonial to the queue. Only the home page shows testimonials, so only
 * / and /en are refreshed.
 */
export async function reviewTestimonialAction(input: {
  id: number;
  status: Enums<"review_status">;
}): Promise<ActionResult> {
  let supabase: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    supabase = await requireAdmin();
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  if (!Number.isInteger(input.id) || !STATUSES.includes(input.status)) return { ok: false, error: "invalid" };

  let query = supabase.from("testimonials").update({ status: input.status }).eq("id", input.id);
  // Never publish without the visitor's consent — RLS already demands it on
  // insert; this keeps it true for any row that reached the table another way.
  if (input.status === "verified") query = query.eq("consent", true);
  const { data, error } = await query.select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "not_found" };

  revalidateBoth("/");
  return { ok: true };
}
