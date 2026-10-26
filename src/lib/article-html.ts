import sanitizeHtml from "sanitize-html";
import { isHtmlBody } from "@/lib/article-format";
import { articleImageOrigins, articleImageSize, isAllowedArticleImage } from "@/lib/article-images";
import { siteUrl } from "@/lib/constants";
import type { Lang } from "@/lib/i18n";
import { markdownToHtml, safeHref } from "@/lib/markdown";

/**
 * Article bodies as HTML that is safe to put on a public page. Runs on the
 * server only (sanitize-html is not shipped to the browser).
 *
 * Two kinds of stored body:
 *
 * - HTML from the visual editor (TipTap) — everything saved since the editor
 *   replaced the Markdown textarea. It passes a strict allowlist: paragraphs,
 *   three heading levels, bold / italic / underline, lists, quotes, links and
 *   images, and text alignment as the only style. Links keep http(s), mailto
 *   and site paths (in the page's language); images keep https URLs on the
 *   media domain or the site itself. Everything else is removed: scripts,
 *   styles, iframes, forms, event handlers, classes, ids, other hosts' images.
 *
 * - Markdown, for articles written before the editor (the body does not start
 *   with "<"). The hardened renderer in src/lib/markdown.ts turns it into HTML
 *   (raw HTML escaped, unsafe links dropped) and its own allowlist follows, as
 *   before. Opening such an article in the editor converts it to HTML.
 */

// ── Markdown (legacy bodies) ─────────────────────────────────────────────────

/** Exactly the tags and attributes the Markdown renderer can produce. */
const MARKDOWN_ALLOWLIST: sanitizeHtml.IOptions = {
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

// ── HTML (the visual editor) ─────────────────────────────────────────────────

const ALIGN = { "text-align": [/^(?:left|right|center|justify|start|end)$/] };
const DIMENSION = /^\d{1,4}$/;

/** The site's own origins (https and http, www and bare): absolute links to them become site paths. */
function siteOrigins(): Set<string> {
  const out = new Set<string>();
  try {
    const { hostname, port } = new URL(siteUrl());
    const bare = hostname.replace(/^www\./, "");
    for (const host of [bare, `www.${bare}`]) {
      for (const scheme of ["https", "http"]) out.add(`${scheme}://${host}${port ? `:${port}` : ""}`);
    }
  } catch {
    // No usable site URL: absolute links simply stay absolute.
  }
  return out;
}

/**
 * A link target for the page's language, or null to drop the link (its text
 * stays). An absolute link to this site becomes a site path first, so
 * "https://www.mazarat-madinah.com/places/quba" in an English article opens
 * /en/places/quba like "/places/quba" does.
 */
function articleHref(raw: string, lang: Lang, own: Set<string>): string | null {
  const href = raw.trim();
  try {
    const url = new URL(href);
    if (own.has(url.origin) && !url.username && !url.password) return safeHref(`${url.pathname}${url.search}${url.hash}`, lang);
  } catch {
    // Not absolute: a path, an anchor, or nothing usable.
  }
  return safeHref(href, lang);
}

function htmlAllowlist(lang: Lang): sanitizeHtml.IOptions {
  const own = siteOrigins();
  const imageOrigins = articleImageOrigins();
  return {
    allowedTags: ["p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "ul", "ol", "li", "blockquote", "a", "img"],
    allowedAttributes: {
      a: ["href", "title", "rel"],
      img: [
        "src",
        "alt",
        "width",
        "height",
        { name: "loading", multiple: false, values: ["lazy"] },
        { name: "decoding", multiple: false, values: ["async"] },
      ],
      p: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
    },
    allowedStyles: { p: ALIGN, h2: ALIGN, h3: ALIGN, h4: ALIGN },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    // Removed together with their content (other disallowed tags keep their text).
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "embed", "template", "svg", "math", "title", "head", "select", "button"],
    transformTags: {
      // The page title is the only h1; deeper levels than the editor offers fold into h4.
      h1: "h2",
      h5: "h4",
      h6: "h4",
      a: (_tag, attribs) => {
        const href = attribs.href ? articleHref(attribs.href, lang, own) : null;
        // A disallowed tag name: the element goes, its text stays.
        if (!href) return { tagName: "x-unlinked", attribs: {} };
        const external = /^(?:https?|mailto):/i.test(href);
        return {
          tagName: "a",
          attribs: {
            href,
            ...(attribs.title ? { title: attribs.title } : {}),
            ...(external ? { rel: "noopener noreferrer" } : {}),
          },
        };
      },
      img: (_tag, attribs) => {
        const src = attribs.src?.trim();
        if (!src || !isAllowedArticleImage(src, imageOrigins)) return { tagName: "img", attribs: {} };
        // Width and height together or not at all; uploads carry theirs in the file name.
        const fromName = articleImageSize(src);
        const size =
          DIMENSION.test(attribs.width ?? "") && DIMENSION.test(attribs.height ?? "")
            ? { width: attribs.width, height: attribs.height }
            : fromName
              ? { width: String(fromName.width), height: String(fromName.height) }
              : null;
        return {
          tagName: "img",
          attribs: { src, alt: attribs.alt ?? "", ...(size ?? {}), loading: "lazy", decoding: "async" },
        };
      },
    },
    // Images whose source was refused leave nothing behind.
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  };
}

/** Editor HTML through the strict allowlist (exported for the tests). */
export function sanitizeArticleHtml(html: string, lang: Lang): string {
  return sanitizeHtml(html, htmlAllowlist(lang)).trim();
}

/** An article body (editor HTML or legacy Markdown) as sanitised HTML, ready for dangerouslySetInnerHTML. */
export function articleHtml(body: string, lang: Lang): string {
  if (!body.trim()) return "";
  if (isHtmlBody(body)) return sanitizeArticleHtml(body, lang);
  const html = markdownToHtml(body, lang);
  return html ? sanitizeHtml(html, MARKDOWN_ALLOWLIST) : "";
}

// ── Plain text (llms-full.txt) ───────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/**
 * An article body as readable text with light Markdown structure (headings,
 * list items, quotes, links), for llms-full.txt. Legacy Markdown bodies are
 * already that and are returned as they are.
 */
export function articleText(body: string, lang: Lang): string {
  if (!isHtmlBody(body)) return body.trim();
  const html = sanitizeArticleHtml(body, lang)
    // The editor wraps list items and quotes in paragraphs; the marker belongs on the text's line.
    .replace(/<(li|blockquote)>\s*<p[^>]*>/g, "<$1>")
    .replace(/<\/p>\s*<\/(li|blockquote)>/g, "</$1>");
  return decode(
    html
      .replace(/<h2[^>]*>/g, "\n\n## ")
      .replace(/<h3[^>]*>/g, "\n\n### ")
      .replace(/<h4[^>]*>/g, "\n\n#### ")
      .replace(/<blockquote[^>]*>/g, "\n\n> ")
      .replace(/<li[^>]*>/g, "\n- ")
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<img [^>]*?alt="([^"]*)"[^>]*>/g, (_m, alt: string) => (alt ? `\n[${alt}]\n` : ""))
      .replace(/<a [^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_m, href: string, text: string) => `${text} (${href})`)
      .replace(/<\/(?:p|h[2-4]|ul|ol|blockquote)>/g, "\n\n")
      .replace(/<p[^>]*>/g, "\n\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
