import { llmsTxt, plainText } from "@/lib/llms";

// Static, refreshed daily and on every admin change (revalidateSite).
export const dynamic = "force-static";
export const revalidate = 86400;

/** llmstxt.org: the site's map for AI agents, in Arabic and English (src/lib/llms.ts). */
export async function GET() {
  return plainText(await llmsTxt());
}
