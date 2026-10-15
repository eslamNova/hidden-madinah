import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml, safeHref } from "./markdown";
import { articleHtml } from "./article-html";
import { markdownSummary, parseSources, slugify, validateArticle, type ArticleInput } from "./article-format";

test("markdown: raw HTML in the body is shown as text, never as markup", () => {
  const html = articleHtml('<script>alert(1)</script>\n\nText <img src=x onerror="alert(1)"> and <b>bold</b>', "ar");
  // No element survives; the attribute is visible text inside an escaped tag.
  assert.doesNotMatch(html, /<script|<img|<b>/i);
  assert.match(html, /&lt;img src=x onerror="alert\(1\)"&gt;/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;b&gt;bold&lt;\/b&gt;/);
});

test("markdown: unsafe link and image targets are dropped, the text stays", () => {
  const html = articleHtml(
    "[a](javascript:alert(1)) [b](data:text/html,x) [c](//evil.example) [d](/\\evil.example) ![e](http://insecure.example/x.png)",
    "ar"
  );
  assert.doesNotMatch(html, /href|src=/);
  for (const text of ["a", "b", "c", "d", "e"]) assert.match(html, new RegExp(`\\b${text}\\b`));
});

test("markdown: safe links keep working; external ones get rel, site paths follow the language", () => {
  const ar = articleHtml("[قباء](/places/quba) [Turath](https://app.turath.io/book/23695) [mail](mailto:a@b.co)", "ar");
  assert.match(ar, /<a href="\/places\/quba">قباء<\/a>/);
  assert.match(ar, /<a href="https:\/\/app\.turath\.io\/book\/23695" rel="noopener noreferrer">Turath<\/a>/);
  assert.match(ar, /href="mailto:a@b\.co"/);
  const en = articleHtml("[Quba](/places/quba) [admin](/admin)", "en");
  assert.match(en, /href="\/en\/places\/quba"/);
  // Paths without an English twin keep their Arabic URL.
  assert.match(en, /href="\/admin"/);
  assert.equal(safeHref("  JaVaScRiPt:alert(1)"), null);
  assert.equal(safeHref("java\tscript:alert(1)"), null);
});

test("markdown: headings start at h2, https images stay, code is escaped", () => {
  const html = articleHtml("# Title\n\n## Part\n\n![alt \"x\"](https://media.example/a.jpg)\n\n```\n<a>&\n```", "en");
  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /<h3>Part<\/h3>/);
  assert.doesNotMatch(html, /<h1/);
  assert.match(html, /<img src="https:\/\/media\.example\/a\.jpg" alt="alt &quot;x&quot;"/);
  assert.match(html, /<pre><code>&lt;a&gt;&amp;\n<\/code><\/pre>/);
});

test("markdown: the sanitiser keeps everything the renderer produces for normal content", () => {
  const md = "Intro with **bold**, *em*, ~~del~~ and `code`.\n\n> A quote\n\n1. one\n2. two\n\n- x\n\n| a | b |\n|:-:|--|\n| 1 | 2 |\n\n---";
  // Only void-element spelling differs (<hr> vs <hr />).
  assert.equal(articleHtml(md, "ar").replace(/ \/>/g, ">"), markdownToHtml(md, "ar"));
  assert.equal(markdownToHtml("   \n", "ar"), "");
});

test("article format: slugs, summaries and sources", () => {
  assert.equal(slugify("Masjid al-Jumu'ah — its story"), "masjid-al-jumuah-its-story");
  assert.equal(slugify("Qubāʾ & the Ḥarrah"), "quba-the-harrah");
  assert.equal(markdownSummary("## Heading\n\nSee [Quba](/places/quba) and **more**."), "Heading See Quba and more.");
  assert.deepEqual(parseSources([{ vol: 3, page: 139, note: " x " }, { vol: "2", page: 5 }, { vol: 0, page: 1 }, "bad", null]), [
    { vol: 3, page: 139, note: "x" },
    { vol: 2, page: 5 },
  ]);
});

const base: ArticleInput = {
  slug: "masjid-al-jumuah",
  title_ar: "مسجد الجمعة",
  title_en: "",
  excerpt_ar: "",
  excerpt_en: "",
  body_ar: "نص",
  body_en: "",
  cover_url: "",
  author: "",
  place_slugs: [],
  journey_slugs: [],
  sources: [],
  tags: "",
  status: "draft",
};

test("article validation: required fields, formats and cleaning", () => {
  assert.deepEqual(validateArticle({ ...base, slug: "Bad Slug" }), { ok: false, error: "slug" });
  assert.deepEqual(validateArticle({ ...base, slug: "trailing-" }), { ok: false, error: "slug" });
  assert.deepEqual(validateArticle({ ...base, title_ar: "  " }), { ok: false, error: "title_ar" });
  assert.deepEqual(validateArticle({ ...base, body_ar: " ", status: "published" }), { ok: false, error: "body_ar" });
  assert.equal(validateArticle({ ...base, body_ar: " ", status: "draft" }).ok, true);
  assert.deepEqual(validateArticle({ ...base, cover_url: "http://x.example/a.jpg" }), { ok: false, error: "cover" });
  assert.deepEqual(validateArticle({ ...base, cover_url: "javascript:alert(1)" }), { ok: false, error: "cover" });
  assert.deepEqual(validateArticle({ ...base, sources: [{ vol: "3", page: "", note: "" }] }), { ok: false, error: "sources" });
  assert.deepEqual(validateArticle({ ...base, tags: "الهجرة" }), { ok: false, error: "tags" });
  assert.deepEqual(validateArticle({ ...base, place_slugs: ["ok", "Not OK"] }), { ok: false, error: "places" });

  const ok = validateArticle({
    ...base,
    title_en: "  Masjid al-Jumu'ah ",
    sources: [{ vol: "3", page: "139", note: "" }, { vol: "", page: "", note: "" }],
    tags: "Hijra, visiting tips،hijra",
    place_slugs: ["quba", "quba", "masjid-al-jumuah"],
    status: "published",
  });
  assert.ok(ok.ok);
  assert.equal(ok.value.title_en, "Masjid al-Jumu'ah");
  assert.equal(ok.value.body_en, null);
  assert.equal(ok.value.excerpt_ar, null);
  assert.deepEqual(ok.value.sources, [{ vol: 3, page: 139 }]);
  assert.deepEqual(ok.value.tags, ["hijra", "visiting-tips"]);
  assert.deepEqual(ok.value.place_slugs, ["quba", "masjid-al-jumuah"]);
});
