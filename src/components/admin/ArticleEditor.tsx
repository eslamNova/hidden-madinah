"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, ExternalLink, ImageUp, Loader2, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import {
  KNOWN_ARTICLE_TAGS,
  SLUG_RE,
  isHtmlBody,
  normalizeTag,
  slugify,
  validateArticle,
  type ArticleInput,
  type ArticleSource,
  type ArticleStatus,
} from "@/lib/article-format";
import { arabicIncludes } from "@/lib/arabic";
import type { Lang } from "@/lib/i18n";
import { markdownToHtml } from "@/lib/markdown";
import { RichTextEditor, UploadNotice } from "@/components/admin/RichTextEditor";
import { useImageUpload } from "@/components/admin/image-upload";
import {
  deleteArticleAction,
  previewArticleBodyAction,
  saveArticleAction,
} from "@/app/(ar)/admin/(protected)/articles/actions";

/** A place or journey the article can link to. */
export type EditorOption = { slug: string; label: string; published: boolean };

/** An article as the editor holds it: empty strings for missing texts. */
export type EditableArticle = {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  excerpt_ar: string;
  excerpt_en: string;
  body_ar: string;
  body_en: string;
  cover_url: string;
  author: string;
  place_slugs: string[];
  journey_slugs: string[];
  sources: ArticleSource[];
  tags: string[];
  status: ArticleStatus;
};

type Texts = { title: string; excerpt: string; body: string };
type SourceRow = { key: number; vol: string; page: string; note: string };

const inputClass = "min-h-[52px] w-full rounded-xl border-[1.5px] border-ink/30 bg-surface px-4 text-lg";
const LANGS: Lang[] = ["ar", "en"];

/**
 * A stored body as editor HTML. Articles written before the visual editor are
 * Markdown: they open converted (site paths kept language-neutral) and are
 * saved as HTML from the first change; until then the stored Markdown is left
 * as it is.
 */
const toEditorHtml = (body: string) => (!body.trim() ? "" : isHtmlBody(body) ? body : markdownToHtml(body, "ar"));

/**
 * The article editor: Arabic and English tabs (title, excerpt, and the body in
 * a Word-like visual editor that uses the public page's typography, with an
 * optional server-rendered preview of exactly what visitors will get), then
 * the slug, cover (uploaded to R2, or a pasted https URL), linked places and
 * journeys, Wafa al-Wafa references, tags and author. One save writes
 * everything and sets the status: a draft is saved or published; a published
 * article is saved as is or unpublished.
 *
 * The status pill changes as soon as a save starts (optimistic) and reverts
 * if the save fails; the status line shows a spinner meanwhile. The same
 * validation as the server action runs first, so most mistakes never leave
 * the page.
 */
export function ArticleEditor({
  article,
  places,
  journeys,
  uploadsEnabled,
  imageOrigins,
}: {
  article: EditableArticle | null;
  places: EditorOption[];
  journeys: EditorOption[];
  /** Whether the R2 variables are set on the server (image uploads work). */
  uploadsEnabled: boolean;
  /** Origins whose images may appear in a body (articleImageOrigins()). */
  imageOrigins: string[];
}) {
  const t = useTranslations("admin.articles");
  const router = useRouter();
  const uid = useId();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<null | "save" | "delete">(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [tab, setTab] = useState<Lang>("ar");
  const [texts, setTexts] = useState<Record<Lang, Texts>>(() => ({
    ar: { title: article?.title_ar ?? "", excerpt: article?.excerpt_ar ?? "", body: article?.body_ar ?? "" },
    en: { title: article?.title_en ?? "", excerpt: article?.excerpt_en ?? "", body: article?.body_en ?? "" },
  }));
  const [slug, setSlug] = useState(article?.slug ?? "");
  // A saved article keeps its URL unless the slug is edited by hand.
  const [slugTouched, setSlugTouched] = useState(!!article);
  const [cover, setCover] = useState(article?.cover_url ?? "");
  const [author, setAuthor] = useState(article?.author ?? "");
  const [placeSlugs, setPlaceSlugs] = useState<string[]>(article?.place_slugs ?? []);
  const [journeySlugs, setJourneySlugs] = useState<string[]>(article?.journey_slugs ?? []);
  const [placeQuery, setPlaceQuery] = useState("");
  const keyRef = useRef(0);
  const [sources, setSources] = useState<SourceRow[]>(() =>
    (article?.sources ?? []).map((s) => ({ key: keyRef.current++, vol: String(s.vol), page: String(s.page), note: s.note ?? "" }))
  );
  const [tags, setTags] = useState((article?.tags ?? []).join(", "));
  const [status, setStatus] = useState<ArticleStatus>(article?.status ?? "draft");

  // The editors start from the saved bodies once; afterwards they own their content.
  const [initialHtml] = useState<Record<Lang, string>>(() => ({
    ar: toEditorHtml(article?.body_ar ?? ""),
    en: toEditorHtml(article?.body_en ?? ""),
  }));
  const [preview, setPreview] = useState<{ lang: Lang; html: string } | "loading" | "error" | null>(null);
  const coverUpload = useImageUpload(uploadsEnabled);
  const coverFileRef = useRef<HTMLInputElement>(null);

  const current = texts[tab];
  const englishComplete = !!texts.en.title.trim() && !!texts.en.body.trim();
  const slugInvalid = slug.trim() !== "" && !SLUG_RE.test(slug.trim());
  const coverPreview = /^https:\/\/\S+$/.test(cover.trim()) ? cover.trim() : null;
  const tagList = tags.split(/[,،]/).map((s) => normalizeTag(s)).filter(Boolean);

  const setText = (lang: Lang, key: keyof Texts, value: string) => {
    setTexts((prev) => ({ ...prev, [lang]: { ...prev[lang], [key]: value } }));
    if (lang === "en" && key === "title" && !slugTouched) setSlug(slugify(value));
    if (key === "body") setPreview(null);
  };

  /** Renders the current tab's body on the server, through the public page's own sanitiser. */
  function showPreview() {
    const lang = tab;
    const body = texts[lang].body;
    setPreview("loading");
    startTransition(async () => {
      const res = await previewArticleBodyAction(body, lang);
      setPreview(res.ok ? { lang, html: res.data.html } : "error");
    });
  }

  async function uploadCover(file: File) {
    const uploaded = await coverUpload.upload(file);
    if (uploaded) setCover(uploaded.url);
  }

  const toggle = (list: string[], value: string, on: boolean) =>
    on ? (list.includes(value) ? list : [...list, value]) : list.filter((v) => v !== value);

  const errorText = (code: string) => (t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic"));

  function buildInput(next: ArticleStatus): ArticleInput {
    return {
      id: article?.id,
      slug: slug.trim(),
      title_ar: texts.ar.title,
      title_en: texts.en.title,
      excerpt_ar: texts.ar.excerpt,
      excerpt_en: texts.en.excerpt,
      body_ar: texts.ar.body,
      body_en: texts.en.body,
      cover_url: cover,
      author,
      place_slugs: placeSlugs,
      journey_slugs: journeySlugs,
      sources: sources.map(({ vol, page, note }) => ({ vol, page, note })),
      tags,
      status: next,
    };
  }

  function save(next: ArticleStatus) {
    if (busy) return;
    const input = buildInput(next);
    const checked = validateArticle(input);
    if (!checked.ok) {
      if (checked.error === "title_ar" || checked.error === "body_ar") setTab("ar");
      setMessage({ ok: false, text: errorText(checked.error) });
      return;
    }
    if (next === "published" && status !== "published" && !window.confirm(t("confirmPublish"))) return;

    const before = status;
    const done =
      next === "published" ? (before === "published" ? "saved" : "published") : before === "published" ? "unpublished" : "draft";
    setStatus(next);
    setBusy("save");
    setMessage(null);
    startTransition(async () => {
      const res = await saveArticleAction(input);
      setBusy(null);
      if (!res.ok) {
        setStatus(before);
        setMessage({ ok: false, text: errorText(res.error) });
        return;
      }
      setMessage({ ok: true, text: t(`done.${done}`) });
      if (!article) router.replace(`/admin/articles/${res.data.id}`);
      else router.refresh();
    });
  }

  function remove() {
    if (!article || busy) return;
    if (!window.confirm(t("confirmDelete"))) return;
    setBusy("delete");
    setMessage(null);
    startTransition(async () => {
      const res = await deleteArticleAction(article.id);
      if (!res.ok) {
        setBusy(null);
        setMessage({ ok: false, text: errorText(res.error) });
        return;
      }
      router.push("/admin/articles");
      router.refresh();
    });
  }

  const onTabKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next: Lang = e.key === "Home" ? "ar" : e.key === "End" ? "en" : tab === "ar" ? "en" : "ar";
    setTab(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };

  const knownPlaces = new Set(places.map((p) => p.slug));
  const placeLabel = (s: string) => places.find((p) => p.slug === s)?.label ?? s;
  const visiblePlaces = placeQuery.trim()
    ? places.filter((p) => arabicIncludes(p.label, placeQuery) || p.slug.includes(placeQuery.trim().toLowerCase()))
    : places;
  const journeyOptions = [
    ...journeys,
    // Linked journeys that no longer exist stay visible so they can be removed.
    ...journeySlugs.filter((s) => !journeys.some((j) => j.slug === s)).map((s) => ({ slug: s, label: s, published: false })),
  ];

  const fieldLabel = "mb-2 block text-base font-semibold";
  const lang = tab;
  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <div className="max-w-2xl space-y-10 pb-8">
      {/* Content, one language at a time */}
      <section className="space-y-4">
        <div role="tablist" aria-label={t("tabsLabel")} className="flex gap-2">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              id={`${uid}-tab-${l}`}
              aria-selected={tab === l}
              aria-controls={`${uid}-panel`}
              tabIndex={tab === l ? 0 : -1}
              onClick={() => setTab(l)}
              onKeyDown={onTabKey}
              className={`flex min-h-12 items-center gap-2 rounded-xl px-5 font-semibold ${
                tab === l ? "bg-basalt text-paper" : "border-[1.5px] border-ink/30 bg-surface"
              }`}
            >
              <span lang={l}>{l === "ar" ? t("tabAr") : t("tabEn")}</span>
              {l === "en" && !englishComplete && <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`${uid}-panel`}
          aria-labelledby={`${uid}-tab-${tab}`}
          className="space-y-5 rounded-2xl border border-ink/10 p-4"
        >
          {tab === "en" && !englishComplete && (
            <p className="flex items-start gap-2 rounded-xl bg-sand p-3 text-base">
              <TriangleAlert aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-accent" />
              {t("englishIncomplete")}
            </p>
          )}
          <div>
            <label htmlFor={`${uid}-title`} className={fieldLabel}>
              {t("fields.title")}
            </label>
            <input
              id={`${uid}-title`}
              type="text"
              lang={lang}
              dir={dir}
              maxLength={200}
              value={current.title}
              onChange={(e) => setText(tab, "title", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-excerpt`} className={fieldLabel}>
              {t("fields.excerpt")}
            </label>
            <textarea
              id={`${uid}-excerpt`}
              rows={3}
              lang={lang}
              dir={dir}
              maxLength={600}
              value={current.excerpt}
              onChange={(e) => setText(tab, "excerpt", e.target.value)}
              className={`${inputClass} py-3 leading-relaxed`}
            />
          </div>
          <div>
            <p id={`${uid}-body-label`} className={fieldLabel}>
              {t("fields.body")}
            </p>
            <p id={`${uid}-body-hint`} className="mb-2 text-sm text-muted">
              {t("editorHint")}
            </p>
            {/* One editor per language, both kept mounted: each keeps its own undo history. */}
            {LANGS.map((l) => (
              <RichTextEditor
                key={l}
                lang={l}
                hidden={l !== tab}
                initialHtml={initialHtml[l]}
                onChange={(html) => setText(l, "body", html)}
                uploadsEnabled={uploadsEnabled}
                imageOrigins={imageOrigins}
                labelledBy={`${uid}-body-label`}
                describedBy={`${uid}-body-hint`}
              />
            ))}
            {!uploadsEnabled && (
              <p className="mt-2 flex items-start gap-2 text-sm font-semibold">
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {t("upload.errors.not_configured")}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <button
              type="button"
              aria-expanded={preview !== null && preview !== "loading"}
              disabled={preview === "loading" || !current.body.trim()}
              onClick={() => (preview && preview !== "loading" ? setPreview(null) : showPreview())}
              className="flex min-h-12 items-center gap-2 rounded-xl border-[1.5px] border-ink/30 bg-surface px-4 font-medium disabled:opacity-50"
            >
              {preview === "loading" ? (
                <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
              ) : preview ? (
                <EyeOff aria-hidden="true" className="h-5 w-5" />
              ) : (
                <Eye aria-hidden="true" className="h-5 w-5" />
              )}
              {preview && preview !== "loading" ? t("previewHide") : t("preview")}
            </button>
            {preview === "error" && <p className="text-sm font-semibold">{t("previewError")}</p>}
            {preview && typeof preview === "object" && preview.lang === tab && (
              <div
                lang={preview.lang}
                dir={preview.lang === "ar" ? "rtl" : "ltr"}
                className="article-body rounded-2xl border border-ink/10 bg-sand/40 p-4"
                // Server-rendered by the public page's own sanitiser (src/lib/article-html.ts).
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            )}
          </div>
        </div>
      </section>

      {/* Address and cover */}
      <section className="space-y-5">
        <div>
          <label htmlFor={`${uid}-slug`} className={fieldLabel}>
            {t("fields.slug")}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={`${uid}-slug`}
              type="text"
              dir="ltr"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={120}
              value={slug}
              aria-invalid={slugInvalid || undefined}
              aria-describedby={`${uid}-slug-hint`}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              className={`${inputClass} min-w-0 flex-1 ${slugInvalid ? "border-accent ring-2 ring-accent" : ""}`}
            />
            <button
              type="button"
              disabled={!texts.en.title.trim()}
              onClick={() => {
                setSlug(slugify(texts.en.title));
                setSlugTouched(false);
              }}
              className="flex min-h-12 items-center rounded-xl border-[1.5px] border-ink/30 bg-surface px-4 font-medium disabled:opacity-50"
            >
              {t("fields.slugSuggest")}
            </button>
          </div>
          <p id={`${uid}-slug-hint`} className={`mt-1 text-sm ${slugInvalid ? "font-semibold" : "text-muted"}`}>
            {slugInvalid ? t("errors.slug") : t("fields.slugHint")}
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className={fieldLabel}>{t("fields.cover")}</legend>
          {coverPreview && (
            // eslint-disable-next-line @next/next/no-img-element -- an arbitrary admin-entered URL, previewed as is
            <img src={coverPreview} alt={t("fields.coverPreviewAlt")} className="aspect-[16/9] w-full max-w-sm rounded-xl object-cover" />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={coverUpload.busy}
              onClick={() => (uploadsEnabled ? coverFileRef.current?.click() : coverUpload.report("not_configured"))}
              className="flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-paper disabled:opacity-60"
            >
              <ImageUp aria-hidden="true" className="h-5 w-5" />
              {coverPreview ? t("fields.coverReplace") : t("fields.coverUpload")}
            </button>
            {cover.trim() && (
              <button
                type="button"
                onClick={() => {
                  setCover("");
                  coverUpload.clear();
                }}
                className="flex min-h-12 items-center gap-2 rounded-xl border-[1.5px] border-ink/30 bg-surface px-4 font-medium"
              >
                <Trash2 aria-hidden="true" className="h-5 w-5" />
                {t("fields.coverRemove")}
              </button>
            )}
            <input
              ref={coverFileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadCover(file);
              }}
            />
          </div>
          <p role="status" aria-live="polite" className="text-sm">
            <UploadNotice status={coverUpload.status} />
          </p>
          <div>
            <label htmlFor={`${uid}-cover`} className="mb-1 block text-sm font-semibold text-muted">
              {t("fields.coverUrl")}
            </label>
            <input
              id={`${uid}-cover`}
              type="url"
              dir="ltr"
              inputMode="url"
              maxLength={1000}
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              aria-describedby={`${uid}-cover-hint`}
              className={inputClass}
            />
          </div>
          <p id={`${uid}-cover-hint`} className="text-sm text-muted">
            {t("fields.coverHint")}
          </p>
        </fieldset>
      </section>

      {/* Linked places */}
      <fieldset className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-4">
        <legend className="px-1 text-base font-semibold">{t("fields.places")}</legend>
        <p className="text-sm text-muted">{t("fields.placesHint")}</p>
        {placeSlugs.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {placeSlugs.map((s) => (
              <li key={s} className="flex min-h-11 items-center gap-1 rounded-full bg-primary/10 ps-3 pe-1 text-sm font-medium text-brand-dark">
                {placeLabel(s)}
                {!knownPlaces.has(s) && <span dir="ltr">({s})</span>}
                <button
                  type="button"
                  aria-label={`${t("fields.removeSource")}: ${placeLabel(s)}`}
                  onClick={() => setPlaceSlugs((prev) => prev.filter((v) => v !== s))}
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          type="search"
          aria-label={t("fields.placesFilter")}
          placeholder={t("fields.placesFilter")}
          value={placeQuery}
          onChange={(e) => setPlaceQuery(e.target.value)}
          className={inputClass}
        />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {visiblePlaces.map((p) => (
            <label key={p.slug} className="flex min-h-11 items-center gap-3 text-lg">
              <input
                type="checkbox"
                checked={placeSlugs.includes(p.slug)}
                onChange={(e) => setPlaceSlugs((prev) => toggle(prev, p.slug, e.target.checked))}
                className="h-5 w-5 shrink-0 accent-[#1F5C3D]"
              />
              <span className="min-w-0">
                {p.label}
                {!p.published && <span className="ms-2 text-sm text-muted">{t("fields.unpublishedPlace")}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Linked journeys */}
      {journeyOptions.length > 0 && (
        <fieldset className="space-y-2 rounded-2xl border border-ink/10 bg-surface p-4">
          <legend className="px-1 text-base font-semibold">{t("fields.journeys")}</legend>
          {journeyOptions.map((j) => (
            <label key={j.slug} className="flex min-h-11 items-center gap-3 text-lg">
              <input
                type="checkbox"
                checked={journeySlugs.includes(j.slug)}
                onChange={(e) => setJourneySlugs((prev) => toggle(prev, j.slug, e.target.checked))}
                className="h-5 w-5 shrink-0 accent-[#1F5C3D]"
              />
              <span className="min-w-0">
                {j.label}
                {!j.published && <span className="ms-2 text-sm text-muted">{t("fields.unpublishedJourney")}</span>}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {/* Wafa al-Wafa references */}
      <fieldset className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-4">
        <legend className="px-1 text-base font-semibold">{t("fields.sources")}</legend>
        {sources.map((row, i) => {
          const set = (key: "vol" | "page" | "note", value: string) =>
            setSources((prev) => prev.map((r) => (r.key === row.key ? { ...r, [key]: value } : r)));
          return (
            <div key={row.key} className="space-y-2 rounded-xl border border-ink/10 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="block w-24">
                  <span className="mb-1 block text-sm font-semibold text-muted">{t("fields.vol")}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10}
                    dir="ltr"
                    value={row.vol}
                    onChange={(e) => set("vol", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block w-28">
                  <span className="mb-1 block text-sm font-semibold text-muted">{t("fields.page")}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    dir="ltr"
                    value={row.page}
                    onChange={(e) => set("page", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block min-w-48 flex-1">
                  <span className="mb-1 block text-sm font-semibold text-muted">{t("fields.note")}</span>
                  <input
                    type="text"
                    maxLength={300}
                    value={row.note}
                    onChange={(e) => set("note", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <button
                  type="button"
                  aria-label={`${t("fields.removeSource")} ${i + 1}`}
                  onClick={() => setSources((prev) => prev.filter((r) => r.key !== row.key))}
                  className="flex min-h-[52px] items-center gap-2 rounded-xl border-[1.5px] border-ink/30 bg-surface px-4 font-medium"
                >
                  <Trash2 aria-hidden="true" className="h-5 w-5" />
                  {t("fields.removeSource")}
                </button>
              </div>
              {row.vol.trim() && row.page.trim() && (
                <p className="text-sm text-muted">«{t("sourcePreview", { vol: row.vol.trim(), page: row.page.trim() })}»</p>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setSources((prev) => [...prev, { key: keyRef.current++, vol: "", page: "", note: "" }])}
          className="flex min-h-12 items-center gap-2 rounded-xl border-[1.5px] border-ink/30 bg-surface px-4 font-medium"
        >
          <Plus aria-hidden="true" className="h-5 w-5" />
          {t("fields.addSource")}
        </button>
      </fieldset>

      {/* Tags and author */}
      <section className="space-y-5">
        <div>
          <label htmlFor={`${uid}-tags`} className={fieldLabel}>
            {t("fields.tags")}
          </label>
          <input
            id={`${uid}-tags`}
            type="text"
            dir="ltr"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            aria-describedby={`${uid}-tags-hint`}
            className={inputClass}
          />
          <p id={`${uid}-tags-hint`} className="mt-1 text-sm text-muted">
            {t("fields.tagsHint", { known: KNOWN_ARTICLE_TAGS.join(", ") })}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {KNOWN_ARTICLE_TAGS.filter((tag) => !tagList.includes(tag)).map((tag) => (
              <button
                key={tag}
                type="button"
                dir="ltr"
                onClick={() => setTags((prev) => [...prev.split(/[,،]/).map((s) => s.trim()).filter(Boolean), tag].join(", "))}
                className="flex min-h-11 items-center gap-1 rounded-full border border-ink/15 bg-surface px-3 text-sm font-medium"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                {tag}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor={`${uid}-author`} className={fieldLabel}>
            {t("fields.author")}
          </label>
          <input
            id={`${uid}-author`}
            type="text"
            maxLength={120}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className={inputClass}
          />
        </div>
      </section>

      {/* Sticky action bar */}
      <div className="sticky bottom-20 z-30 space-y-2 rounded-2xl border border-ink/10 bg-surface/95 p-3 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              status === "published" ? "bg-primary/10 text-brand-dark" : "bg-basalt/10 text-muted"
            }`}
          >
            {t(`status.${status}`)}
          </span>
          {status === "draft" ? (
            <>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => save("draft")}
                className="flex min-h-12 items-center rounded-2xl border-[1.5px] border-ink/30 bg-surface px-5 font-medium disabled:opacity-60"
              >
                {t("saveDraft")}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => save("published")}
                className="flex min-h-12 items-center rounded-2xl bg-primary px-6 font-semibold text-paper disabled:opacity-60"
              >
                {t("publish")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => save("published")}
                className="flex min-h-12 items-center rounded-2xl bg-primary px-6 font-semibold text-paper disabled:opacity-60"
              >
                {t("saveChanges")}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => save("draft")}
                className="flex min-h-12 items-center rounded-2xl border-[1.5px] border-ink/30 bg-surface px-5 font-medium disabled:opacity-60"
              >
                {t("unpublish")}
              </button>
            </>
          )}
          {article && (
            <button
              type="button"
              disabled={!!busy}
              onClick={remove}
              className="ms-auto flex min-h-12 items-center gap-2 rounded-2xl px-4 font-medium underline disabled:opacity-60"
            >
              <Trash2 aria-hidden="true" className="h-5 w-5" />
              {t("delete")}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" aria-live="polite" className="flex min-h-6 items-center gap-2 text-sm font-medium">
            {busy ? (
              <>
                <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
                {busy === "delete" ? t("deleting") : t("saving")}
              </>
            ) : message ? (
              <>
                {!message.ok && <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" />}
                <span className={message.ok ? "text-brand" : "font-semibold"}>{message.text}</span>
              </>
            ) : null}
          </p>
          {article && status === "published" && !busy && (
            <a
              href={`/blog/${article.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand underline"
            >
              {t("view")}
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
