/**
 * Lists the Gemini models this API key can call, so GEMINI_MODEL_FAST and
 * GEMINI_MODEL_SMART are picked from what actually exists today.
 *
 * Run: npx tsx scripts/gemini-models.ts
 * Needs: GEMINI_API_KEY in .env.local
 */
import dotenv from "dotenv";
import { gemini } from "../src/lib/ai/gemini";

dotenv.config({ path: ".env.local", quiet: true });

async function main() {
  const pager = await gemini().models.list({ config: { pageSize: 100 } });
  const rows: string[] = [];
  for await (const m of pager) {
    const actions = m.supportedActions ?? [];
    if (!actions.includes("generateContent")) continue;
    rows.push(`${m.name?.replace("models/", "")}\t${m.inputTokenLimit ?? "?"} in / ${m.outputTokenLimit ?? "?"} out\t${m.displayName ?? ""}`);
  }
  console.log(rows.sort().join("\n"));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
