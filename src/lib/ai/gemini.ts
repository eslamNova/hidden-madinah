import { GoogleGenAI, type GenerateContentConfig, type GenerateContentResponseUsageMetadata } from "@google/genai";

/**
 * Thin Gemini wrapper shared by the API routes and the offline content
 * scripts. Server-side only: it reads GEMINI_API_KEY, which must never reach
 * the browser (no NEXT_PUBLIC_ prefix).
 *
 * Two model tiers, both set by env so we can switch without a deploy diff:
 *   GEMINI_MODEL_FAST  — visitor-facing (guide chat, planner parsing)
 *   GEMINI_MODEL_SMART — offline content work (claim extraction, translation)
 * `npx tsx scripts/gemini-models.ts` lists what the key can use.
 */

let client: GoogleGenAI | null = null;

export function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export type ModelTier = "fast" | "smart";

export function modelFor(tier: ModelTier): string {
  const name = tier === "fast" ? process.env.GEMINI_MODEL_FAST : process.env.GEMINI_MODEL_SMART;
  if (!name) throw new Error(`GEMINI_MODEL_${tier.toUpperCase()} is not set`);
  return name;
}

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};

export function toUsage(meta: GenerateContentResponseUsageMetadata | undefined): Usage {
  return {
    inputTokens: meta?.promptTokenCount ?? 0,
    // Thinking tokens are billed as output.
    outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
    cachedTokens: meta?.cachedContentTokenCount ?? 0,
  };
}

/**
 * One call that must come back as JSON matching `schema` (a JSON Schema
 * object). Throws if the model returns something that doesn't parse, so
 * callers never act on a half-formed object.
 */
export async function generateJson<T>(opts: {
  tier: ModelTier;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  config?: GenerateContentConfig;
}): Promise<{ data: T; usage: Usage }> {
  const res = await gemini().models.generateContent({
    model: modelFor(opts.tier),
    contents: opts.prompt,
    config: {
      systemInstruction: opts.system,
      responseMimeType: "application/json",
      responseJsonSchema: opts.schema,
      temperature: 0.2,
      ...opts.config,
    },
  });
  const text = res.text;
  if (!text) throw new Error(`Empty JSON response (finish: ${res.candidates?.[0]?.finishReason ?? "unknown"})`);
  return { data: JSON.parse(text) as T, usage: toUsage(res.usageMetadata) };
}

/**
 * Streamed text generation. Yields text deltas; the final usage arrives with
 * the last chunk and is exposed through `onUsage`.
 */
export async function* streamText(opts: {
  tier: ModelTier;
  system: string;
  contents: Parameters<GoogleGenAI["models"]["generateContentStream"]>[0]["contents"];
  config?: GenerateContentConfig;
  onUsage?: (usage: Usage) => void;
}): AsyncGenerator<string> {
  const stream = await gemini().models.generateContentStream({
    model: modelFor(opts.tier),
    contents: opts.contents,
    config: { systemInstruction: opts.system, temperature: 0.2, ...opts.config },
  });
  let lastMeta: GenerateContentResponseUsageMetadata | undefined;
  for await (const chunk of stream) {
    if (chunk.usageMetadata) lastMeta = chunk.usageMetadata;
    const text = chunk.text;
    if (text) yield text;
  }
  opts.onUsage?.(toUsage(lastMeta));
}
