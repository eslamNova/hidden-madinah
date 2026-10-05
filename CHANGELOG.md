# Changelog

## Hackathon build — 4–6 October 2026

AI Challenge Serving Islamic Content (Bathel Foundation), Track 3.
Starting point: tag `pre-hackathon` (commit `94b5b49`). Everything below was
built inside the challenge window; the judges can diff `pre-hackathon..master`.

### M0 — Scaffolding
- Service worker never caches our own `/api/` responses (AI answers are per-request).
- Gemini client wrapper (`src/lib/ai/gemini.ts`) with JSON-schema and streaming helpers; model names come from env.
- `scripts/gemini-models.ts` lists the models available to the key.
