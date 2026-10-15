"use server";

import { revalidateSite } from "@/lib/revalidate";
import { requireAdmin, type ActionResult } from "@/lib/admin-auth";
import { validateArticle, type ArticleErrorCode, type ArticleInput, type ArticleStatus } from "@/lib/article-format";
import { isMissingTable } from "@/lib/articles";
import type { TablesInsert } from "@/lib/database.types";

/** Message keys under admin.articles.errors. */
export type ArticleActionError = ArticleErrorCode | "unauthorized" | "slug_taken" | "missing_table" | "not_found" | "generic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dbError(error: { code?: string; message?: string }): ArticleActionError {
  if (isMissingTable(error)) return "missing_table";
  if (error.code === "23505") return "slug_taken";
  if (error.code === "23514") return "too_long";
  return "generic";
}

/**
 * Create or update an article and set its status in one save: «حفظ كمسودة»
 * and «إلغاء النشر» save it as a draft, «نشر» and «حفظ التعديلات» (on a
 * published article) save it published. The database stamps published_at the
 * first time an article is published (migration 009) and keeps it after.
 * Articles appear on the blog, the sitemap and the RSS feeds in both
 * languages, so every save refreshes the whole site.
 */
export async function saveArticleAction(
  input: ArticleInput
): Promise<ActionResult<{ id: string; slug: string; status: ArticleStatus }>> {
  let supabase: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    supabase = await requireAdmin();
  } catch {
    return { ok: false, error: "unauthorized" };
  }

  const checked = validateArticle(input);
  if (!checked.ok) return { ok: false, error: checked.error };
  const id = typeof input.id === "string" && input.id ? input.id : null;
  if (id && !UUID_RE.test(id)) return { ok: false, error: "not_found" };

  const row: TablesInsert<"articles"> = { ...checked.value };
  const query = id
    ? supabase.from("articles").update(row).eq("id", id).select("id, slug, status").maybeSingle()
    : supabase.from("articles").insert(row).select("id, slug, status").single();
  const { data, error } = await query;
  if (error) return { ok: false, error: dbError(error) };
  if (!data) return { ok: false, error: "not_found" };

  revalidateSite();
  return { ok: true, data: { id: data.id, slug: data.slug, status: data.status === "published" ? "published" : "draft" } };
}

/** Delete one article for good (the editor asks for confirmation first). */
export async function deleteArticleAction(id: string): Promise<ActionResult> {
  let supabase: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    supabase = await requireAdmin();
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  if (typeof id !== "string" || !UUID_RE.test(id)) return { ok: false, error: "not_found" };

  const { data, error } = await supabase.from("articles").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: dbError(error) };
  if (!data?.length) return { ok: false, error: "not_found" };

  revalidateSite();
  return { ok: true };
}
