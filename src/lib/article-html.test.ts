import { test } from "node:test";
import assert from "node:assert/strict";
import { articleHtml, articleText, sanitizeArticleHtml } from "./article-html";
import { bodySummary, isHtmlBody, normalizeEditorLink } from "./article-format";

// The site's own origin, as on production (siteUrl() reads it at call time).
process.env.NEXT_PUBLIC_SITE_URL = "https://www.mazarat-madinah.com";

const MEDIA = "https://media.mazarat-madinah.com/articles/2026/10/3f9c0a1b2c3d4e5f-1600x900.webp";

test("editor html: script, style, iframe and other active content are removed with their content", () => {
  const html = sanitizeArticleHtml(
    '<p>a</p><script>alert(1)</script><style>p{color:red}</style><iframe src="https://evil.example"></iframe>' +
      '<object data="x"></object><embed src="x"><svg><script>alert(2)</script></svg><template><p>t</p></template>' +
      '<form action="https://evil.example"><input name="x"><button>go</button></form><noscript><p>n</p></noscript>',
    "ar"
  );
  assert.doesNotMatch(html, /<(?:script|style|iframe|object|embed|svg|template|form|input|button|noscript)/i);
  assert.doesNotMatch(html, /alert|color:red|go<|>n</);
  assert.equal(html, "<p>a</p>");
});

test("editor html: event handlers, classes, ids and inline styles other than alignment are removed", () => {
  const html = sanitizeArticleHtml(
    `<p onclick="alert(1)" class="x" id="y" style="color:red;position:fixed">t</p>` +
      `<img src="${MEDIA}" onerror="alert(1)" onload="alert(2)" style="width:9999px" class="z">` +
      `<a href="https://example.com" onmouseover="alert(1)" target="_blank" style="color:red">l</a>`,
    "ar"
  );
  assert.doesNotMatch(html, /on(?:click|error|load|mouseover)|class=|id=|style=|target=|alert/);
  assert.match(html, /^<p>t<\/p>/);
});

test("editor html: javascript:, data: and other unsafe link targets lose the link, keep the text", () => {
  const html = sanitizeArticleHtml(
    '<p><a href="javascript:alert(1)">a</a> <a href=" JaVaScRiPt:alert(1)">b</a> <a href="java&#09;script:alert(1)">c</a> ' +
      '<a href="data:text/html,<script>alert(1)</script>">d</a> <a href="vbscript:x">e</a> <a href="//evil.example">f</a> ' +
      '<a href="/\\evil.example">g</a> <a>h</a></p>',
    "ar"
  );
  assert.doesNotMatch(html, /<a|href|javascript|script/i);
  for (const text of ["a", "b", "c", "d", "e", "f", "g", "h"]) assert.match(html, new RegExp(`\\b${text}\\b`));
});

test("editor html: images stay only from the media domain or the site itself, over https", () => {
  const html = sanitizeArticleHtml(
    `<img src="${MEDIA}" alt="ok">` +
      '<img src="https://evil.example/x.png" alt="other host">' +
      '<img src="http://media.mazarat-madinah.com/articles/2026/10/a-10x10.webp" alt="http">' +
      '<img src="//media.mazarat-madinah.com/x.webp" alt="protocol-relative">' +
      '<img src="data:image/png;base64,iVBORw0KGgo=" alt="data">' +
      '<img src="javascript:alert(1)" alt="js">' +
      '<img src="https://media.mazarat-madinah.com.evil.example/x.webp" alt="lookalike">' +
      '<img src="https://user@media.mazarat-madinah.com/x.webp" alt="credentials">' +
      '<img alt="no src">' +
      '<img src="https://www.mazarat-madinah.com/og-image.jpg" alt="site">' +
      '<img src="/icons/icon-512.png" alt="site path">',
    "ar"
  );
  assert.equal((html.match(/<img/g) ?? []).length, 3);
  assert.match(html, /alt="ok"/);
  assert.match(html, /alt="site"/);
  assert.match(html, /alt="site path"/);
  assert.doesNotMatch(html, /evil|http:|data:|javascript|\/\/media\.mazarat-madinah\.com\/x|user@|no src/);
});

test("editor html: allowed tags are kept as written", () => {
  const input =
    "<h2>عنوان</h2><h3>فرعي</h3><h4>صغير</h4>" +
    "<p><strong>غامق</strong> <b>b</b> <em>مائل</em> <i>i</i> <u>مسطّر</u><br>سطر</p>" +
    "<ul><li><p>أ</p></li><li><p>ب</p><ol><li><p>١</p></li></ol></li></ul>" +
    "<blockquote><p>اقتباس</p></blockquote>";
  // Only void-element spelling differs (<br> vs <br />).
  assert.equal(sanitizeArticleHtml(input, "ar").replace(/ \/>/g, ">"), input);
});

test("editor html: text alignment is kept on paragraphs and headings, nothing else in style", () => {
  const html = sanitizeArticleHtml(
    '<p style="text-align: center">c</p><h2 style="text-align: end; color: red">e</h2><h3 style="text-align:start">s</h3>' +
      '<h4 style="text-align: justify">j</h4><p style="text-align: right">r</p><p style="text-align: left">l</p>' +
      '<p style="text-align: expression(alert(1))">x</p><li style="text-align:center">li</li>',
    "ar"
  );
  assert.match(html, /<p style="text-align:center">c<\/p>/);
  assert.match(html, /<h2 style="text-align:end">e<\/h2>/);
  assert.match(html, /<h3 style="text-align:start">s<\/h3>/);
  assert.match(html, /<h4 style="text-align:justify">j<\/h4>/);
  assert.match(html, /<p style="text-align:right">r<\/p>/);
  assert.match(html, /<p style="text-align:left">l<\/p>/);
  assert.match(html, /<p>x<\/p>/);
  assert.match(html, /<li>li<\/li>/);
  assert.doesNotMatch(html, /color|expression/);
});

test("editor html: links get rel on external targets; site links follow the page's language", () => {
  const body =
    '<p><a href="https://app.turath.io/book/23695" rel="opener" title="t">Turath</a> <a href="mailto:a@b.co">m</a> ' +
    '<a href="/places/quba">Quba</a> <a href="https://www.mazarat-madinah.com/places/quba?x=1#map">abs</a> ' +
    '<a href="https://mazarat-madinah.com/en/journeys/hijra">bare</a> <a href="#sources">anchor</a></p>';
  const ar = sanitizeArticleHtml(body, "ar");
  assert.match(ar, /<a href="https:\/\/app\.turath\.io\/book\/23695" title="t" rel="noopener noreferrer">Turath<\/a>/);
  assert.match(ar, /<a href="mailto:a@b\.co" rel="noopener noreferrer">m<\/a>/);
  assert.match(ar, /<a href="\/places\/quba">Quba<\/a>/);
  assert.match(ar, /<a href="\/places\/quba\?x=1#map">abs<\/a>/);
  assert.match(ar, /<a href="\/journeys\/hijra">bare<\/a>/);
  assert.match(ar, /<a href="#sources">anchor<\/a>/);
  assert.doesNotMatch(ar, /opener"|rel="opener/);
  const en = sanitizeArticleHtml(body, "en");
  assert.match(en, /<a href="\/en\/places\/quba">Quba<\/a>/);
  assert.match(en, /<a href="\/en\/places\/quba\?x=1#map">abs<\/a>/);
  assert.match(en, /<a href="\/en\/journeys\/hijra">bare<\/a>/);
});

test("editor html: other tags are unwrapped (text kept), h1 becomes h2, image sizes come from the file name", () => {
  const html = sanitizeArticleHtml(
    `<h1>Top</h1><div><span>in div</span></div><table><tr><td>cell</td></tr></table><h6>deep</h6>` +
      `<img src="${MEDIA}" alt="x"><img src="${MEDIA}" width="800" height="450" alt="y"><img src="${MEDIA}" width="100%" height="auto" alt="z">`,
    "en"
  );
  assert.match(html, /^<h2>Top<\/h2>in divcell<h4>deep<\/h4>/);
  assert.match(html, /<img src="[^"]+" alt="x" width="1600" height="900" loading="lazy" decoding="async" \/>/);
  assert.match(html, /<img src="[^"]+" alt="y" width="800" height="450"/);
  assert.match(html, /<img src="[^"]+" alt="z" width="1600" height="900"/);
});

test("article bodies: HTML goes through the editor allowlist, Markdown through the old renderer", () => {
  assert.equal(isHtmlBody("  <p>x</p>"), true);
  assert.equal(isHtmlBody("## Heading"), false);
  assert.equal(articleHtml("<p>نص <script>x</script></p>", "ar"), "<p>نص </p>");
  assert.match(articleHtml("## Part\n\n**bold**", "ar"), /<h3>Part<\/h3>\n<p><strong>bold<\/strong><\/p>/);
  // Raw HTML inside a Markdown body is still shown as text.
  assert.match(articleHtml("Text <b>x</b>", "ar"), /&lt;b&gt;x&lt;\/b&gt;/);
  assert.equal(articleHtml("   ", "ar"), "");
});

test("article bodies: summaries and plain text read HTML too", () => {
  assert.equal(bodySummary("<h2>عنوان</h2><p>نص &amp; <strong>غامق</strong>&nbsp;هنا</p>"), "عنوان نص & غامق هنا");
  assert.equal(bodySummary("## Heading\n\nSee [Quba](/places/quba)."), "Heading See Quba.");
  const text = articleText(
    '<h2>Part</h2><p>See <a href="/places/quba">Quba</a> &amp; more.</p><ul><li><p>one</p></li><li><p>two</p></li></ul><blockquote><p>quote</p></blockquote>',
    "en"
  );
  assert.equal(text, "## Part\n\nSee Quba (/en/places/quba) & more.\n\n- one\n- two\n\n> quote");
});

test("editor links: typed addresses are completed or refused", () => {
  assert.equal(normalizeEditorLink("www.example.com"), "https://www.example.com");
  assert.equal(normalizeEditorLink("example.com/page?x=1"), "https://example.com/page?x=1");
  assert.equal(normalizeEditorLink(" https://app.turath.io/book/1 "), "https://app.turath.io/book/1");
  assert.equal(normalizeEditorLink("/places/quba"), "/places/quba");
  assert.equal(normalizeEditorLink("#sources"), "#sources");
  assert.equal(normalizeEditorLink("info@example.com"), "mailto:info@example.com");
  assert.equal(normalizeEditorLink("javascript:alert(1)"), null);
  assert.equal(normalizeEditorLink("//evil.example"), null);
  assert.equal(normalizeEditorLink("data:text/html,x"), null);
  assert.equal(normalizeEditorLink("two words"), null);
  assert.equal(normalizeEditorLink(""), null);
});
