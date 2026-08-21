export const SITE_NAME = "دليل المدينة الخفية";
export const SITE_DESCRIPTION =
  "دليل عملي للأماكن الأقل شهرة في المدينة المنورة: مساجد أثرية وآبار وبساتين ومواقع تاريخية، مع المسافة من المسجد النبوي وكيفية الوصول وتكلفة المواصلات.";

/** Font size steps (px) applied on <html> via data-font-step. */
export const FONT_STEPS = [18, 20, 23] as const;
export const FONT_STEP_STORAGE_KEY = "hm-font-step";

/** Time-based ISR safety net; admin edits revalidate on demand. */
export const REVALIDATE_SECONDS = 86400;

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
