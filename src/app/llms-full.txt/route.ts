import { llmsFullTxt, plainText } from "@/lib/llms";

// Static, refreshed daily and on every admin change (revalidateSite).
export const dynamic = "force-static";
export const revalidate = 86400;

/** llms.txt plus the verified public text of places, journeys, stories and articles (src/lib/llms.ts). */
export async function GET() {
  return plainText(await llmsFullTxt());
}
