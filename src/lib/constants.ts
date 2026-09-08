export const SITE_NAME = "مزارات المدينة";
export const SITE_DESCRIPTION =
  "دليل عملي لمزارات المدينة المنورة الأقل شهرة: مساجد أثرية وآبار وبساتين ومواقع تاريخية، مع المسافة من المسجد النبوي وكيفية الوصول وتكلفة المواصلات.";

/** Font size steps (px) applied on <html> via data-font-step. */
export const FONT_STEPS = [18, 20, 23] as const;
export const FONT_STEP_STORAGE_KEY = "hm-font-step";

/** Theme applied on <html> via data-theme ("light" | "dark"), persisted. */
export const THEME_STORAGE_KEY = "hm-theme";
export type Theme = "light" | "dark";

/** Analytics consent, persisted. Absent means "not asked yet". */
export const CONSENT_STORAGE_KEY = "hm-consent";
export type ConsentChoice = "granted" | "denied";

/**
 * GA4 measurement ID (G-XXXXXXXXXX). Unset in local dev and previews, which
 * keeps both the tag and the consent notice off — production traffic is the
 * only traffic worth counting, and preview hits would pollute the numbers we
 * show partners. Vercel Analytics is independent of this.
 */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

/** Time-based ISR safety net; admin edits revalidate on demand. */
export const REVALIDATE_SECONDS = 86400;

/**
 * Public contact address shown on the privacy notice. Empty hides the section
 * — a legal page carries a real inbox or none at all, never a placeholder.
 */
export const CONTACT_EMAIL = "islam.a.i@outlook.com";

/** Shown on /privacy so visitors can see when the notice last changed. */
export const PRIVACY_UPDATED = "8 سبتمبر 2026";

/**
 * Companion app «سيرة» (free Seerah audio journey) — recommended on place
 * pages: the visitor stands where the story happened; the app tells it whole.
 */
export const SEERAH_APP = {
  appStore:
    "https://apps.apple.com/sa/app/%D8%B3%D9%8A%D8%B1%D8%A9-%D8%A7%D9%84%D8%B3%D9%8A%D8%B1%D8%A9-%D8%A7%D9%84%D9%86%D8%A8%D9%88%D9%8A%D8%A9/id6747294522?l=ar",
  googlePlay: "https://play.google.com/store/apps/details?id=qafelah_app.qafelah_app",
} as const;

/**
 * The app's Telegram channel — new places announced first, plus photos and
 * visiting notes. Invite-style link: it stays valid if the channel is renamed.
 */
export const TELEGRAM_CHANNEL = "https://t.me/+j_RAlim-5ZE2MTJk";

/**
 * Absolute site origin, used for canonical URLs, OG images, sitemap and robots.
 * Prefers an explicit NEXT_PUBLIC_SITE_URL (custom domain), then falls back to
 * the Vercel production URL so a fresh deploy is correct without configuration.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) return `https://${vercelProduction}`;
  return "http://localhost:3000";
}
