"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Check, Link2, Share2 } from "lucide-react";

/**
 * Share buttons under an article: the phone's own share sheet (Web Share API,
 * shown only where the browser has it), Facebook, WhatsApp, X and «copy
 * link». The shared URL is the article's canonical address; Facebook,
 * WhatsApp and X build the preview card from the page's Open Graph tags
 * (cover, title, description — see articleMetadata in src/views/article.tsx).
 */

const noSubscribe = () => () => {};
const hasWebShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

// Brand marks (simple-icons paths, 24×24): lucide no longer ships brand icons.
const FACEBOOK =
  "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z";
const WHATSAPP =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z";
const X_MARK =
  "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z";

function Mark({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor">
      <path d={d} />
    </svg>
  );
}

/** Copies text, falling back to a hidden textarea where the async clipboard is unavailable (http, old WebViews). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

const button =
  "press inline-flex min-h-12 items-center gap-2 rounded-2xl border-[1.5px] border-ink/30 bg-surface px-4 font-medium";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const t = useTranslations("blog.share");
  const canShare = useSyncExternalStore(noSubscribe, hasWebShare, () => false);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const enc = encodeURIComponent;
  const networks = [
    { key: "facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, d: FACEBOOK, color: "text-[#1877F2]" },
    { key: "whatsapp", href: `https://wa.me/?text=${enc(`${title}\n${url}`)}`, d: WHATSAPP, color: "text-[#128C7E]" },
    { key: "x", href: `https://x.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`, d: X_MARK, color: "" },
  ] as const;

  const onCopy = async () => {
    const ok = await copyText(url);
    setCopy(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopy("idle"), 3000);
  };

  const onNativeShare = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      // Dismissed, or the share target failed: nothing to report.
    }
  };

  return (
    <section aria-labelledby="article-share" className="space-y-3">
      <h2 id="article-share" className="text-xl">
        {t("title")}
      </h2>
      <div className="flex flex-wrap gap-2">
        {canShare && (
          <button type="button" onClick={onNativeShare} className="press inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-paper">
            <Share2 aria-hidden="true" className="h-5 w-5 shrink-0" />
            {t("native")}
          </button>
        )}
        {networks.map((n) => (
          <a
            key={n.key}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("shareOn", { network: t(n.key) })}
            className={button}
          >
            <span className={n.color || undefined}>
              <Mark d={n.d} />
            </span>
            {t(n.key)}
          </a>
        ))}
        <button type="button" onClick={onCopy} className={button}>
          {copy === "copied" ? (
            <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-brand" />
          ) : (
            <Link2 aria-hidden="true" className="h-5 w-5 shrink-0" />
          )}
          {copy === "copied" ? t("copied") : t("copy")}
        </button>
      </div>
      <p role="status" aria-live="polite" className={copy === "idle" ? "sr-only" : "text-sm text-muted"}>
        {copy === "copied" ? t("copied") : copy === "failed" ? t("copyFailed") : ""}
      </p>
    </section>
  );
}
