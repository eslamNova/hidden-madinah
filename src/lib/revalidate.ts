import { revalidatePath } from "next/cache";
import { localizeHref } from "@/lib/i18n";

/**
 * Revalidates a public path and its English twin (/plan and /en/plan), so an
 * admin edit never leaves one language stale. Admin paths have no twin.
 */
export function revalidateBoth(path: string, type?: "layout" | "page") {
  revalidatePath(path, type);
  const en = localizeHref(path, "en");
  if (en !== path) revalidatePath(en, type);
}
