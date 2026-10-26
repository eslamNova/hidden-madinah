import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isArticleStatus, parseSources } from "@/lib/article-format";
import { ArticleEditor, type EditableArticle } from "@/components/admin/ArticleEditor";
import { editorMediaOptions, loadEditorOptions } from "../options";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const t = await getTranslations("admin.articles");
  const supabase = await createClient();

  const [{ data: row }, options] = await Promise.all([
    supabase.from("articles").select("*").eq("id", id).maybeSingle(),
    loadEditorOptions(supabase),
  ]);
  if (!row) notFound();

  const article: EditableArticle = {
    id: row.id,
    slug: row.slug,
    title_ar: row.title_ar,
    title_en: row.title_en ?? "",
    excerpt_ar: row.excerpt_ar ?? "",
    excerpt_en: row.excerpt_en ?? "",
    body_ar: row.body_ar,
    body_en: row.body_en ?? "",
    cover_url: row.cover_url ?? "",
    author: row.author ?? "",
    place_slugs: row.place_slugs ?? [],
    journey_slugs: row.journey_slugs ?? [],
    sources: parseSources(row.sources),
    tags: row.tags ?? [],
    status: isArticleStatus(row.status) ? row.status : "draft",
  };

  return (
    <div className="space-y-6">
      <Link href="/admin/articles" className="text-brand underline">
        {t("back")}
      </Link>
      <h2 className="text-xl">
        {t("edit")}: {row.title_ar.trim() || t("untitled")}
      </h2>
      {/* Keyed by id: after "new" redirects here, the editor starts from the saved row. */}
      <ArticleEditor
        key={row.id}
        article={article}
        places={options.places}
        journeys={options.journeys}
        {...editorMediaOptions()}
      />
    </div>
  );
}
