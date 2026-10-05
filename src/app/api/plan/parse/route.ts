import { generateJson } from "@/lib/ai/gemini";
import { PARSE_SCHEMA, PARSE_SYSTEM, parseRequestFallback, sanitizeParsed, type ParsedRequest } from "@/lib/planner/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/plan/parse {text} → {parsed, source: "ai" | "keywords"}
 * The AI only reads the request; the route itself is solved in the browser
 * by the deterministic planner. If the model is unavailable, a keyword
 * parser answers instead, so the planner keeps working.
 */

const hits = new Map<string, number[]>();
const PER_MINUTE = 6;

export async function POST(request: Request) {
  let text = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim().slice(0, 500) : "";
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  if (!text) return Response.json({ error: "empty" }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  if (recent.length > PER_MINUTE) {
    return Response.json({ parsed: parseRequestFallback(text), source: "keywords" });
  }

  try {
    const { data } = await generateJson<Partial<ParsedRequest>>({
      tier: "fast",
      system: PARSE_SYSTEM,
      prompt: text,
      schema: PARSE_SCHEMA,
    });
    const parsed = sanitizeParsed(data);
    // The keyword parser fills anything the model left unknown.
    const kw = parseRequestFallback(text);
    return Response.json({
      parsed: {
        minutes: parsed.minutes ?? kw.minutes,
        companions: parsed.companions ?? kw.companions,
        mobility: parsed.mobility ?? kw.mobility,
        interests: parsed.interests.length ? parsed.interests : kw.interests,
        start: parsed.start ?? kw.start,
        mode: parsed.mode ?? kw.mode,
      } satisfies ParsedRequest,
      source: "ai",
    });
  } catch (err) {
    console.error("plan parse fallback", err instanceof Error ? err.message.slice(0, 200) : err);
    return Response.json({ parsed: parseRequestFallback(text), source: "keywords" });
  }
}
