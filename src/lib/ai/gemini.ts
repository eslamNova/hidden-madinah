import {
  GoogleGenAI,
  ThinkingLevel,
  type GenerateContentConfig,
  type GenerateContentResponseUsageMetadata,
} from "@google/genai";

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

/**
 * Primary model plus fallbacks (GEMINI_FALLBACK_MODELS, comma-separated).
 * Free-tier Flash models return 503 "high demand" in bursts; a capacity error
 * moves the call to the next model instead of failing the visitor.
 */
export function modelChain(tier: ModelTier): string[] {
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.6-flash,gemini-3-flash-preview")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([modelFor(tier), ...fallbacks])];
}

const isCapacityError = (err: unknown) =>
  /"code":\s*(429|500|503)|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded/i.test(err instanceof Error ? err.message : String(err));

/**
 * Visitor-facing calls think at LOW: measured on gemini-3.8-flash, a short
 * Seerah answer drops from ~10s (default dynamic thinking) to ~2s with the
 * same quality on grounded questions. Offline work keeps the model default.
 */
function tierConfig(tier: ModelTier): GenerateContentConfig {
  return tier === "fast" ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {};
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
}): Promise<{ data: T; usage: Usage; model: string }> {
  let lastErr: unknown;
  for (const model of modelChain(opts.tier)) {
    try {
      return { ...(await generateJsonOnce<T>(model, opts)), model };
    } catch (err) {
      lastErr = err;
      if (!isCapacityError(err)) throw err;
    }
  }
  throw lastErr;
}

async function generateJsonOnce<T>(
  model: string,
  opts: { tier: ModelTier; system: string; prompt: string; schema: Record<string, unknown>; config?: GenerateContentConfig }
): Promise<{ data: T; usage: Usage }> {
  const res = await gemini().models.generateContent({
    model,
    contents: opts.prompt,
    config: {
      systemInstruction: opts.system,
      responseMimeType: "application/json",
      responseJsonSchema: opts.schema,
      temperature: 0.2,
      ...tierConfig(opts.tier),
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
  onModel?: (model: string) => void;
}): AsyncGenerator<string> {
  // Fallback only applies before the first chunk: once text has reached the
  // visitor we can't switch models mid-sentence.
  let stream: AsyncGenerator<import("@google/genai").GenerateContentResponse> | undefined;
  let lastErr: unknown;
  for (const model of modelChain(opts.tier)) {
    try {
      stream = await gemini().models.generateContentStream({
        model,
        contents: opts.contents,
        config: { systemInstruction: opts.system, temperature: 0.2, ...tierConfig(opts.tier), ...opts.config },
      });
      opts.onModel?.(model);
      break;
    } catch (err) {
      lastErr = err;
      if (!isCapacityError(err)) throw err;
    }
  }
  if (!stream) throw lastErr;
  let lastMeta: GenerateContentResponseUsageMetadata | undefined;
  for await (const chunk of stream) {
    if (chunk.usageMetadata) lastMeta = chunk.usageMetadata;
    const text = chunk.text;
    if (text) yield text;
  }
  opts.onUsage?.(toUsage(lastMeta));
}
