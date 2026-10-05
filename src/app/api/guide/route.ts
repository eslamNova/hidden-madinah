import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { modelFor, streamText, type Usage } from "@/lib/ai/gemini";
import { buildGuideContext, type CitationInfo, type GuideRequestContext } from "@/lib/guide/context";
import { UNAVAILABLE, systemPrompt } from "@/lib/guide/prompt";
import { guardAnswer, parseAnswer, replyLanguage } from "@/lib/guide/answer";
import type { Lang } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/guide — the AI guide. Streams NDJSON:
 *   {"t":"p","s":"search"} / {"t":"p","s":"facts","n":12}  progress
 *   {"t":"d","v":"<text delta>"}                       …repeated
 *   {"t":"m","type":"answer|practical|refuse|refer","citations":[…],"replace"?:"…"}
 * `replace` means the server guard rewrote the answer (e.g. a historical
 * answer that cited nothing): the client shows `replace` instead.
 *
 * Body: { question, history?, place?, journey?, stop?, location?, lang? }.
 * `lang` is the page's language ("ar" unless exactly "en"): it picks the
 * language of the context and the prompt. The reply — and the refusal and
 * referral wording — follows the question's script, so a question written in
 * Arabic on an English page is answered in Arabic.
 */

type HistoryTurn = { role: "user" | "model"; text: string };
type Body = Omit<GuideRequestContext, "lang"> & { question?: string; history?: HistoryTurn[]; lang?: unknown };

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Per-instance burst limit: stops one tab from hammering the model. Overall
// volume is bounded by the Gemini project's own quota, not by a table the
// public anon key could write to.
const hits = new Map<string, number[]>();
const PER_MINUTE = 8;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > PER_MINUTE;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json(400, { error: "bad_json" });
  }
  const question = (body.question ?? "").trim().slice(0, 600);
  if (!question) return json(400, { error: "empty" });
  const pageLang: Lang = body.lang === "en" ? "en" : "ar";
  const lang = replyLanguage(question, pageLang);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) return json(429, { error: "rate_limited" });

  const location =
    body.location && Number.isFinite(body.location.lat) && Number.isFinite(body.location.lng)
      ? { lat: Number(body.location.lat), lng: Number(body.location.lng) }
      : undefined;
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((h) => (h.role === "user" || h.role === "model") && typeof h.text === "string")
    .slice(-6)
    .map((h) => ({ role: h.role, parts: [{ text: h.text.slice(0, 1500) }] }));

  const started = Date.now();
  const encoder = new TextEncoder();
  let usage: Usage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };
  let usedModel = modelFor("fast");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // A visitor who closes the chat mid-answer closes the stream; keep going
      // quietly so the answer is still logged.
      let open = true;
      const send = (obj: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          open = false;
        }
      };
      // Progress events let the chat show what is happening while the
      // (free-tier) model works: searching → N verified facts → writing.
      send({ t: "p", s: "search" });
      const ctx = await buildGuideContext({
        place: typeof body.place === "string" ? body.place : undefined,
        journey: typeof body.journey === "string" ? body.journey : undefined,
        stop: typeof body.stop === "number" ? body.stop : undefined,
        location,
        lang: pageLang,
      });
      send({ t: "p", s: "facts", n: ctx.claims.size });
      let full = "";
      let emitted = 0;
      try {
        for await (const delta of streamText({
          tier: "fast",
          system: systemPrompt(ctx.factsBlock, ctx.practicalBlock, pageLang),
          contents: [...history, { role: "user", parts: [{ text: question }] }],
          onUsage: (u) => (usage = u),
          onModel: (m) => (usedModel = m),
        })) {
          full += delta;
          // Hold back the tail so the trailing <<type:…>> marker never reaches the screen.
          const marker = full.indexOf("<<");
          const safeEnd = marker >= 0 ? marker : Math.max(emitted, full.length - 16);
          if (safeEnd > emitted) {
            send({ t: "d", v: full.slice(emitted, safeEnd) });
            emitted = safeEnd;
          }
        }
      } catch (err) {
        console.error("guide model error", err);
        if (parseAnswer(full).body.length > 40) {
          // The stream broke after a usable answer: keep it and let the
          // citation guard below judge it like any other answer.
          if (!/<<\s*type/i.test(full)) full += "\n<<type:answer>>";
        } else {
          full = `${UNAVAILABLE[lang]}\n<<type:refuse>>`;
          emitted = Number.MAX_SAFE_INTEGER; // force a clean `replace` below
        }
      }

      // ── Guard ────────────────────────────────────────────────────────────
      // Judged on content, not on the model's own label (see guardAnswer).
      // The same rules on both languages' pages; only the refusal and
      // referral wording follows the reply language.
      const { type, text, valid } = guardAnswer({ raw: full, question, allowed: ctx.claims, lang });

      // Finish the stream in `full` coordinates: if the final text simply
      // continues what was already shown, send the rest; otherwise replace.
      let replace: string | undefined;
      const shown = emitted === Number.MAX_SAFE_INTEGER ? null : full.slice(0, emitted).trimStart();
      if (shown !== null && text.startsWith(shown)) {
        const rest = text.slice(shown.length);
        if (rest) send({ t: "d", v: rest });
      } else {
        replace = text;
      }

      const citations: CitationInfo[] = valid.map((id) => ctx.claims.get(id)!);
      send({ t: "m", type, citations, ...(replace ? { replace } : {}) });

      // Log before closing: the function stays alive until close, so the row
      // is written even when the visitor has already left.
      const { error: logErr } = await db.from("guide_logs").insert({
        lang,
        context: ctx.label,
        question,
        answer: text.slice(0, 8000),
        cited_claim_ids: valid,
        refused: type === "refuse",
        model: usedModel,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        cached_tokens: usage.cachedTokens,
        latency_ms: Date.now() - started,
      });
      if (logErr) console.error("guide log failed", logErr.message);
      if (open) {
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
