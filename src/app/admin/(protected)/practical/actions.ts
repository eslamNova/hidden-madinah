"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, type ActionResult } from "@/lib/admin-auth";
import type { Json } from "@/lib/database.types";

export type PracticalInput = {
  id: string;
  slug: string;
  visit_minutes: number | null;
  has_stairs: boolean | null;
  walking_effort: "low" | "medium" | "high" | null;
  wheelchair_ok: boolean | null;
  /** null = unknown · "always" · [from, to] as "HH:MM" */
  hours: null | "always" | [string, string];
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function savePracticalAction(input: PracticalInput): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    if (input.visit_minutes !== null && !(input.visit_minutes > 0 && input.visit_minutes <= 300)) {
      return { ok: false, error: "visit_minutes" };
    }
    let opening_hours: Json | null = null;
    if (input.hours === "always") opening_hours = { always: true };
    else if (Array.isArray(input.hours)) {
      const [from, to] = input.hours;
      if (!HHMM.test(from) || !HHMM.test(to)) return { ok: false, error: "hours" };
      opening_hours = { daily: [[from, to]] };
    }
    const { error } = await supabase
      .from("places")
      .update({
        visit_minutes: input.visit_minutes,
        has_stairs: input.has_stairs,
        walking_effort: input.walking_effort,
        wheelchair_ok: input.wheelchair_ok,
        opening_hours,
      })
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/plan");
    revalidatePath("/journeys", "layout");
    revalidatePath(`/places/${input.slug}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "unauthorized" };
  }
}
