import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ArticleEditor } from "@/components/admin/ArticleEditor";
import { loadEditorOptions } from "../options";

export default async function NewArticlePage() {
  const t = await getTranslations("admin.articles");
  const supabase = await createClient();
  const { places, journeys } = await loadEditorOptions(supabase);
  return (
    <div className="space-y-6">
      <Link href="/admin/articles" className="text-brand underline">
        {t("back")}
      </Link>
      <h2 className="text-xl">{t("new")}</h2>
      <ArticleEditor article={null} places={places} journeys={journeys} />
    </div>
  );
}
