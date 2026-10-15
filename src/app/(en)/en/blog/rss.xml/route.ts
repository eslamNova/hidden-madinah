import { articlesFeed } from "@/lib/rss";

// Static, refreshed daily and on every admin change (revalidateSite).
export const dynamic = "force-static";
export const revalidate = 86400;

export function GET() {
  return articlesFeed("en");
}
