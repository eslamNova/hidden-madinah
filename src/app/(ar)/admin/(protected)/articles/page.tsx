import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { articleHasEnglish, ARTICLE_STATUSES, type ArticleStatus } from "@/lib/article-format";
import { isMissingTable } from "@/lib/articles";
import { INTL_LOCALE } from "@/lib/i18n";

const WHEN = new Intl.DateTimeFormat(INTL_LOCALE.ar, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" });

type Filter = ArticleStatus | "all";
const FILTERS: Filter[] = ["all", ...ARTICLE_STATUSES];

/** «المقالات»: every article, drafts included, most recently edited first. */
export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const t = await getTranslations("admin.articles");
  const sp = await searchParams;
  const filter: Filter = (FILTERS as string[]).includes(sp.status ?? "") ? (sp.status as Filter) : "all";
  const supabase = await createClient();

  const countOf = (f: Filter) => {
    const q = supabase.from("articles").select("id", { count: "exact", head: true });
    return f === "all" ? q : q.eq("status", f);
  };
  let list = supabase
    .from("articles")
    .select("id, slug, title_ar, title_en, body_en, status, updated_at, published_at")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (filter !== "all") list = list.eq("status", filter);
  const [{ data, error }, ...counts] = await Promise.all([list, ...FILTERS.map(countOf)]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-xl">{t("title")}</h2>
          <p className="text-muted">{t("intro")}</p>
        </div>
        <Link
          href="/admin/articles/new"
          className="flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-paper"
        >
          <Plus aria-hidden="true" className="h-5 w-5" />
          {t("new")}
        </Link>
      </div>

      {isMissingTable(error) ? (
        <p role="alert" className="flex items-start gap-2 rounded-2xl border-[1.5px] border-accent bg-sand p-4 font-semibold">
          <TriangleAlert aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-accent" />
          {t("missingTable")}
        </p>
      ) : error ? (
        <p role="alert" className="rounded-2xl border border-ink/10 bg-surface p-4 font-semibold">
          {t("loadError")}
        </p>
      ) : (
        <>
          <nav aria-label={t("statusNav")} className="flex flex-wrap gap-2">
            {FILTERS.map((f, i) => (
              <Link
                key={f}
                href={f === "all" ? "/admin/articles" : `/admin/articles?status=${f}`}
                aria-current={f === filter ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${
                  f === filter ? "bg-basalt text-paper" : "bg-surface"
                }`}
              >
                {t(`filter.${f}`)}
                {counts[i]?.count != null && <span className="ltr-nums ms-1 opacity-80">({counts[i].count})</span>}
              </Link>
            ))}
          </nav>

          {(data ?? []).length === 0 ? (
            <p className="rounded-2xl border border-ink/10 bg-surface p-4">{t("empty")}</p>
          ) : (
            <ul className="space-y-3">
              {(data ?? []).map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/admin/articles/${a.id}`}
                    className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-semibold">{a.title_ar.trim() || t("untitled")}</span>
                      <span className="block text-sm text-muted">
                        <span dir="ltr" className="ltr-nums">
                          {a.slug}
                        </span>
                        {" · "}
                        {t("updated", { date: WHEN.format(new Date(a.updated_at)) })}
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        articleHasEnglish(a) ? "bg-basalt/10" : "border-[1.5px] border-accent bg-sand"
                      }`}
                    >
                      {articleHasEnglish(a) ? t("hasEnglish") : t("noEnglish")}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        a.status === "published" ? "bg-primary/10 text-brand-dark" : "bg-basalt/10 text-muted"
                      }`}
                    >
                      {t(`status.${a.status === "published" ? "published" : "draft"}`)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
