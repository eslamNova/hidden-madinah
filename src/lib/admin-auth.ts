import { createClient } from "@/lib/supabase/server";

/**
 * Server-side admin gate for server actions outside the original
 * admin/actions.ts. Returns the caller's (RLS-bound) Supabase client, or
 * throws "unauthorized" — callers translate that into an ActionResult.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) throw new Error("unauthorized");
  return supabase;
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };
