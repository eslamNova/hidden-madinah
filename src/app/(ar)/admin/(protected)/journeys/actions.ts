"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, type ActionResult } from "@/lib/admin-auth";

function refresh(slug?: string) {
  revalidatePath("/journeys");
  revalidatePath("/my-journey");
  if (slug) revalidatePath(`/journeys/${slug}`);
  revalidatePath("/admin/journeys");
}

/**
 * Approve a stop's narration. The reviewer sees the stop's cited claims on the
 * same screen; with `withClaims` the still-pending ones are approved too, so a
 * published stop never cites an unreviewed claim.
 */
export async function approveStopAction(input: {
  stopId: string;
  journeySlug: string;
  withClaims: boolean;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { data: stop, error: stopErr } = await supabase
      .from("journey_stops")
      .select("claim_ids")
      .eq("id", input.stopId)
      .single();
    if (stopErr) return { ok: false, error: stopErr.message };
    if (input.withClaims && stop.claim_ids.length) {
      const { error } = await supabase
        .from("claims")
        .update({ status: "verified", reviewed_at: new Date().toISOString(), en_reviewed: true })
        .in("id", stop.claim_ids)
        .eq("status", "pending");
      if (error) return { ok: false, error: error.message };
    }
    const { error } = await supabase.from("journey_stops").update({ status: "verified" }).eq("id", input.stopId);
    if (error) return { ok: false, error: error.message };
    refresh(input.journeySlug);
    return { ok: true };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}

export async function setStopStatusAction(input: {
  stopId: string;
  journeySlug: string;
  status: "pending" | "rejected";
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("journey_stops").update({ status: input.status }).eq("id", input.stopId);
    if (error) return { ok: false, error: error.message };
    refresh(input.journeySlug);
    return { ok: true };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}

export async function setQuizStatusAction(input: {
  ids: string[];
  journeySlug: string;
  status: "verified" | "rejected" | "pending";
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("quiz_items").update({ status: input.status }).in("id", input.ids);
    if (error) return { ok: false, error: error.message };
    refresh(input.journeySlug);
    return { ok: true };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}

export async function setJourneyPublishedAction(input: { slug: string; published: boolean }): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("journeys").update({ is_published: input.published }).eq("slug", input.slug);
    if (error) return { ok: false, error: error.message };
    refresh(input.slug);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}
