import { revalidatePath } from "next/cache";
import { localizeHref } from "@/lib/i18n";

/**
 * Refreshes every public page in both languages (and the sitemap) after an
 * admin edit. Pages live in route groups — (ar) and (en) — so a page's layout
 * tags carry the group (`/(ar)/journeys/layout`), and revalidatePath("/x",
 * "layout") no longer matches them; only the root layout tag is shared by
 * every page. The site is small and ISR regenerates on the next visit, so
 * refreshing everything is both correct and cheap.
 */
export function revalidateSite() {
  revalidatePath("/", "layout");
}

/** One exact page and its English twin (/plan and /en/plan) — for pages without dynamic segments. */
export function revalidateBoth(path: string) {
  revalidatePath(path);
  const en = localizeHref(path, "en");
  if (en !== path) revalidatePath(en);
}
