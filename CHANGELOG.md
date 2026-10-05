# Changelog

## Hackathon build — 4–6 October 2026

AI Challenge Serving Islamic Content (Bathel Foundation), Track 3.
Starting point: tag `pre-hackathon` (commit `94b5b49`). Everything below was
built inside the challenge window; the judges can diff `pre-hackathon..master`.

### M0 — Scaffolding
- Service worker never caches our own `/api/` responses (AI answers are per-request).
- Gemini client wrapper (`src/lib/ai/gemini.ts`) with JSON-schema and streaming helpers; model names come from env.
- `scripts/gemini-models.ts` lists the models available to the key.

### M1 — Verified knowledge base and review console
- Migration `006_knowledge.sql`: sources, claims (source page, verbatim quote, al-Samarrai cross-reference, content level A–D, themes, review status), journeys, quiz items, anonymous guide logs and quiz results. Row-level security: visitors read only *verified* claims of published places.
- Source: *Wafa al-Wafa* (al-Samhudi), Dar al-Kutub al-'Ilmiyya edition via Turath, each passage cross-matched against al-Samarrai's critical edition (`scripts/content/build_wafa_corpus.py`). Passages without a match are flagged "verify against al-Samarrai".
- 198 claims for 11 places, each checked word for word against its cited page before import (`scripts/content/validate_claims.py`, `scripts/import-claims.ts`) and imported as *pending*.
- `/admin/claims`: approve, edit or reject each claim next to its source passage.

### M2 — AI guide with refusal
- `/api/guide`: answers only from verified claims and cites each one; the server rejects any citation it did not provide and replaces an uncited factual answer with the refusal «لا أملك مصدرًا موثقًا لهذا».
- Personal fatwa, family, legal and medical questions get a referral (risala.prh.gov.sa), never a ruling. AI disclosure above the chat.
- Practical facts (distance, walking time, open now, stairs) are computed in code, not by the model.
- Streams live progress (searching → N verified facts → writing); falls back across Gemini models when one is busy.

### M3 — Knowledge journeys, QR check-in, My journey
- `/journeys`: five journeys (Hijra, Quba and the wells, Uhud, the Trench, ancient mosques) with a pre-quiz, stops, a post-quiz and a completion card. Every stop script and quiz item is reviewed in `/admin/journeys` before publication.
- Browser narration (ar-SA voice) with play/pause/speed.
- QR check-in at each site (`/admin/qr` prints the sheet); `/my-journey` shows visited places and progress, stored on the device only.
- Anonymous, opt-in quiz results measure the before/after gain in understanding.
- Migration `008_hardening.sql` and an adversarial review: 33 confirmed issues fixed.

### M4 — Trip planner, «عندي ساعتين، وش أزور؟»
- `/plan`: five questions (time, companions, walking, interests, start) or free text. Gemini only *reads* the request into those answers; the route itself is solved by a deterministic, unit-tested planner (`src/lib/planner/solver.ts`).
- Door-to-door timing including the way back, walking limits by mobility, stairs warnings with a reachable step-free alternative, taxi fare bands, a Google Maps link and sharing.
- Works without the AI: an on-device keyword reader fills the form instantly; the AI refines it if it answers within a few seconds.
- Hotel mode: `/plan?from=…&name=…` plus a printable reception card with a QR (`/admin/hotel`).
- 24 unit tests (`npm test`) for the planner and the keyword reader.

### M5 — English
- Every public page has an English twin under `/en` (home, places, place pages, map, routes, tours, journeys, My journey, planner, privacy); Arabic URLs unchanged. Two root layouts give each language the right `lang`/`dir` from the first byte, and every page stays static.
- 471 texts translated (interface, places, routes) through translate → faithfulness check → English edit, following the organizers' scientific package: Quran from an approved translation with surah:ayah, hadith keep narrator and source, Arabic hedges kept. English pages state the translation awaits scholarly review.
- Each English place/route text stores a hash of the Arabic it came from: when the Arabic is edited, the stale English is hidden instead of shown. Claims appear in English only when their translation was reviewed.
- The guide answers in English with the same citation guard, English refusal and referrals, and English source titles; narration uses an English voice; maps show English names; search ignores accents.
- Language switch beside the text-size control; hreflang alternates; sitemap lists both languages; admin edits refresh both languages.

### M6 — Stories, tags, testimonials, "how far am I"
- `/stories`: the verified "human moments" from *Wafa al-Wafa* grouped by theme (mercy, humility, brotherhood, loyalty…), each with its source and a link to its place; English shows only reviewed translations.
- Journeys carry tags (first visit, family, evening, seasonal) with filters, and link to the stories.
- Visitor testimonials: an optional form at the end of a journey (explicit consent, moderated in `/admin/testimonials`, approved ones on the home page). Database rules verified: visitors can only submit with consent and as pending.
- Place pages: "How far am I from here?" — distance and walking/driving time computed on the device, on request; "you are here" after a QR scan.
- Review fixes: admin edits refresh the whole site in both languages; the floating language control no longer blocks taps on phones; edited claims hide their stale English.
