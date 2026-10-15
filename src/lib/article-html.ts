import sanitizeHtml from "sanitize-html";
import type { Lang } from "@/lib/i18n";
import { markdownToHtml } from "@/lib/markdown";

/**
 * Server-side second layer for public article pages: the hardened Markdown
 * renderer's output (src/lib/markdown.ts) passes a strict allowlist of the
 * tags and attributes that renderer can produce. Anything else — a tag the
 * renderer never emits, an event handler, a style, an unsafe URL scheme — is
 * dropped, so a renderer bug cannot become script on the page.
 */
const ALLOWLIST: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "h2", "h3", "h4", "h5", "h6", "blockquote", "ul", "ol", "li", "hr", "br",
    "strong", "em", "del", "code", "pre", "a", "img",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel"],
    img: ["src", "alt", "title", "loading", "decoding"],
    ol: ["start"],
    th: [{ name: "align", multiple: false, values: ["left", "center", "right"] }],
    td: [{ name: "align", multiple: false, values: ["left", "center", "right"] }],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["https"] },
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
};

/** An article body (Markdown) as sanitised HTML, ready for dangerouslySetInnerHTML. */
export function articleHtml(md: string, lang: Lang): string {
  const html = markdownToHtml(md, lang);
  return html ? sanitizeHtml(html, ALLOWLIST) : "";
}
