import { Marked } from "marked";
import { localizeHref, type Lang } from "@/lib/i18n";

/**
 * Markdown → HTML for blog articles, hardened at the renderer:
 *
 * - Raw HTML in the body is never passed through: block and inline HTML are
 *   rendered as visible, escaped text (an admin who types <b> sees "<b>").
 * - Links keep only http(s), mailto, site paths ("/places/quba") and in-page
 *   anchors; anything else (javascript:, data:, //host, \host) loses its link
 *   and keeps its text. Site paths follow the page's language, so
 *   "/places/quba" in an English article opens /en/places/quba.
 * - Images keep only https sources.
 * - Headings move down one level (# → h2): the page title is the only h1.
 * - Code blocks carry no class; task-list boxes become ☐ / ☑ text.
 *
 * Every attribute value is escaped here. Public pages also run the output
 * through a tag/attribute allowlist on the server (src/lib/article-html.ts);
 * the admin preview uses this module alone, on the admin's own text.
 */

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** marked's own URL clean-up: encode what needs it without double-encoding existing escapes. */
function encodeUrl(href: string): string | null {
  try {
    return encodeURI(href).replace(/%25/g, "%");
  } catch {
    return null;
  }
}

/** A link target that is safe to render, in the page's language — or null. */
export function safeHref(raw: string, lang: Lang = "ar"): string | null {
  const href = raw.trim();
  if (!href || /[\u0000-\u001f\u007f\\]/.test(href)) return null;
  if (/^#[\w-]*$/.test(href)) return href;
  // A site path: one leading slash only ("//host" is another site).
  if (/^\/(?!\/)\S*$/.test(href)) {
    const encoded = encodeUrl(href);
    return encoded ? localizeHref(encoded, lang) : null;
  }
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:" ? url.href : null;
}

/** An image source that is safe to render (https only) — or null. */
export function safeImageSrc(raw: string): string | null {
  const src = raw.trim();
  if (!src || /[\u0000-\u001f\u007f\\]/.test(src)) return null;
  try {
    const url = new URL(src);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function createMarked(lang: Lang) {
  return new Marked({
    gfm: true,
    breaks: false,
    async: false,
    renderer: {
      html({ text }) {
        return escapeHtml(text);
      },
      heading({ tokens, depth }) {
        const level = Math.min(depth + 1, 6);
        return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const safe = safeHref(href, lang);
        if (!safe) return text;
        const external = /^(?:https?|mailto):/i.test(safe);
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
        const rel = external ? ' rel="noopener noreferrer"' : "";
        return `<a href="${escapeHtml(safe)}"${titleAttr}${rel}>${text}</a>`;
      },
      image({ href, title, text }) {
        const src = safeImageSrc(href);
        if (!src) return escapeHtml(text);
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy" decoding="async">`;
      },
      code({ text, escaped }) {
        const body = text.replace(/\n$/, "") + "\n";
        return `<pre><code>${escaped ? body : escapeHtml(body)}</code></pre>\n`;
      },
      checkbox({ checked }) {
        return checked ? "☑ " : "☐ ";
      },
    },
  });
}

const renderers: Partial<Record<Lang, Marked>> = {};

/** Article Markdown as HTML (see the rules above). Synchronous; empty input gives "". */
export function markdownToHtml(md: string, lang: Lang = "ar"): string {
  if (!md.trim()) return "";
  const marked = (renderers[lang] ??= createMarked(lang));
  return marked.parse(md, { async: false });
}
