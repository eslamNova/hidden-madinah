# Content and Sources Documentation

**مزارات المدينة / Mazarat Madinah**: <https://www.mazarat-madinah.com> (English at `/en`)
AI Challenge Serving Islamic Content (Bathel Foundation), Track 3: interactive experiences and knowledge journeys.

This file is the content and sources documentation the participant guide requires: "توثيق المحتوى والمصادر الشرعية والمعرفية وكيفية استخدامها والتحقق منها" (deliverable 05, guide p. 14), together with the register of sources, tools and licences (guide p. 32, item 06). It covers where the content comes from, how it is checked, and how the product uses it. Each statement points to the code or data that implements it. Section 16 lists what is still missing.

Snapshot date: **6 October 2026**. Build window: 4–6 October 2026. Baseline tag: `pre-hackathon`. See `CHANGELOG.md`.


---

## ملخص بالعربية

- **المصدر الأساسي:** «وفاء الوفاء بأخبار دار المصطفى» للسمهودي (ت 911هـ)، طبعة دار الكتب العلمية (بيروت، ط1، 1419هـ، 4 مجلدات)، من نص منصة «تراث» (الكتاب 23695). تُقابَل كل فقرة آليًا بطبعة قاسم السامرائي المحققة (مؤسسة الفرقان، 5 مجلدات). وما لم يطابَق يظهر للمراجع بعلامة «لم تُطابَق — يجب التحقق قبل النشر».
- **استخراج المعلومات:** تُصاغ كل معلومة من نص الفقرات المعطاة فقط، لا من الذاكرة. ويرافقها مقتطف حرفي يُتحقق برمجيًا من وجوده في الفقرة والصفحة المحال إليهما. ثم تُستورد بحالة «بانتظار المراجعة».
- **المراجعة البشرية:** لا تظهر معلومة للزائر ولا للمرشد الذكي إلا بعد اعتمادها يدويًا في لوحة `/admin/claims`. وتفرض قاعدة البيانات ذلك بسياسات أمان الصفوف (RLS).
- **المرشد الذكي:** يجيب من المعلومات المعتمدة فقط، مع إحالة [C‹رقم›] يتحقق منها الخادم. فإن لم يجد مصدرًا قال: «لا أملك مصدرًا موثقًا لهذا…». ويحيل أسئلة الفتوى الشخصية إلى التوجيه الرسمي (risala.prh.gov.sa).
- **الترجمة الإنجليزية:** لم تراجعها جهة علمية بعد، ويُصرَّح بذلك في صفحات المواضع والجولات والرحلات والقصص الإنجليزية.
- **حدود العمل:** المراجِع اليوم هو صاحب المشروع، والمعتمد حتى الآن 27 معلومة من 198 (بعد رفض ثلاث معلومات معتمدة في 6 أكتوبر، القسم 15.1). ومراجعة عالم متخصص لكل ما اعتُمد مخطط لها بعد التحدي.

---

## 1. At a glance

| What | Where | Status (6 Oct 2026) |
|---|---|---|
| Primary source: *Wafa al-Wafa* (al-Samhudi), Dar al-Kutub al-'Ilmiyya ed., 1419 AH | `supabase/migrations/006_knowledge.sql` (`sources` row `wafa-dki`) | Built |
| Per-place corpus with printed vol/page, cross-matched to al-Samarrai's critical edition | `scripts/content/build_wafa_corpus.py` | Built: 813 paragraphs for 10 places + the Prophet's Mosque; 753 matched |
| Claims drafted from the corpus, each with a verbatim excerpt | `content/claims/*.json` | Built: 194 drafts in the repo, 193 of them imported (one skipped as a duplicate of a reviewed claim); 198 claims in the database (see 7.3) |
| Verbatim-quote validation before import | `scripts/content/validate_claims.py`, `scripts/import-claims.ts` | Built |
| Human review console | `/admin/claims` (`src/app/(ar)/admin/(protected)/claims/`, `src/components/admin/ClaimReviewList.tsx`) | Built; review in progress (section 7.3) |
| Visitors only ever read verified claims | RLS policy "public read verified claims" (migration 006); column grant (migration 008) | Built |
| AI guide: verified claims only, server-checked citations, refusal, referral | `src/app/api/guide/route.ts`, `src/lib/guide/{context,prompt,answer}.ts` | Built; 14 unit tests (`npm test`) |
| Human stories built from verified `humane` claims | `/stories`, `src/lib/stories.ts` | Built (M6, commit `b0f1f89`) |
| English with hash-stamped translations; claims in English only when reviewed | `content/i18n/en.json`, `src/lib/i18n-content.ts`, `scripts/i18n/` | Built; scholarly review of the English **not done yet** |
| Independent scholar review of everything approved | — | **Planned** after the challenge |

---

## 2. Two content layers

The site has two kinds of text. The guarantees in this document apply to the second.

1. **Place pages (written before the challenge).** The story, virtue, featured quote, visiting tips and logistics of each place were written before 4 October under the owner's review. They name their hadith and Seerah sources in the text: Sahih al-Bukhari, Sahih Muslim, Sunan al-Nasa'i, Sunan Ibn Majah, Musnad Ahmad, al-Tabarani's *al-Mu'jam al-Kabir*, Ibn Shabba's *Tarikh al-Madinah*, Ibn Hisham's *al-Sira al-Nabawiyya* and Ibn Sa'd's *al-Tabaqat*. Any fact still waiting for confirmation carries an inline `[VERIFY: …]` marker. `stripVerify()` in `src/lib/content.ts` removes the marker and its content from every page the app renders, and the admin shows a "needs review" badge for that field. These texts are **not** linked to claim IDs. The AI guide does not use them. For history it reads only verified claims; for practical questions it gets distances and times computed in code, plus opening hours, access and transport from the place records (section 9).
2. **The verified knowledge base (built during the challenge).** These are atomic, cited **claims** drawn from *Wafa al-Wafa*, each reviewed by a person before publication. Journeys, the human stories page, the planner's "one fact per stop" and the AI guide are all built on this layer.

---

## 3. Primary source and edition

| | |
|---|---|
| Work | *Wafa al-Wafa bi-Akhbar Dar al-Mustafa* (وفاء الوفاء بأخبار دار المصطفى) |
| Author | Nur al-Din 'Ali ibn 'Abd Allah al-Samhudi (d. 911 AH) |
| Text we quote | Dar al-Kutub al-'Ilmiyya, Beirut, 1st ed., 1419 AH, 4 vols, via Turath (book 23695, <https://app.turath.io/book/23695>) |
| Cross-check edition | al-Samhudi, ed. Qasim al-Samarrai, Al-Furqan Islamic Heritage Foundation, 5 vols (critical edition) |
| Database records | `sources` rows `wafa-dki` and `wafa-samarrai` in `supabase/migrations/006_knowledge.sql` |

**Why *Wafa al-Wafa*.** It is the most comprehensive classical reference on the history and sites of Madinah. It covers the mosques, wells, gardens and battlefields that are this platform's places. It also gathers earlier reports and names their sources, including the early Madinan historians Ibn Zabala and Ibn Shabba, so a claim can say who reported what. The Turath page ranges used for each place, chosen from the book's table of contents, are listed in `PLACES` in `scripts/content/build_wafa_corpus.py`.

**Why this edition for quoting, with al-Samarrai as the check.** Our proposal names al-Samarrai's critical edition, the scholarly standard, whose editor traces the hadith in his footnotes. We had it only as scanned pages with OCR text. OCR noise makes a word-for-word quote check unreliable, but it is good enough for fuzzy matching. The Dar al-Kutub al-'Ilmiyya text on Turath, by contrast, is clean digital text with the printed volume and page of every passage. So we split the roles:

- **Dar al-Kutub al-'Ilmiyya** is the text every claim quotes and cites (vol/page). A reader can open the same page on Turath, and the review console links to the book there.
- **al-Samarrai** is the cross-check. Each passage is matched against the critical edition, and the match is stored with the claim and shown to the reviewer and the visitor (section 4).

The `wafa-dki` source note in the database states this split: «النص المعتمد للاستخراج. ليست الطبعة المحققة؛ تُقابَل المواضع بطبعة السامرائي قبل النشر.» ("The text used for extraction. Not the critical edition; passages are checked against al-Samarrai's edition before publication.")

---

## 4. Cross-check against al-Samarrai's critical edition

Implemented in `scripts/content/build_wafa_corpus.py` (Python standard library only):

1. **Primary text.** The script downloads the Turath book JSON (clean text with printed vol/page) into `.cache/turath/`. It splits the place's page ranges into paragraphs and keeps those of 60 characters or more.
2. **Critical-edition index.** It reads the owner's OCR'd EPUBs of al-Samarrai's five volumes, made from Internet Archive scans. These are never committed. It builds an inverted index of normalised Arabic character 6-grams over every scanned page. Normalisation strips diacritics and unifies alef, ya, ta marbuta and hamza forms. The printed page is the scan page + 1 in all five volumes.
3. **Matching.** Each paragraph is scored against every scanned page. A match is recorded only if at least **30%** of the paragraph's 6-grams fall on a single page (`MATCH_THRESHOLD = 0.30`). Very short paragraphs (fewer than 40 distinct 6-grams) are never matched. A match is stored as the critical edition's volume, page and score.
4. **Result in this build:** 813 paragraphs, **753 matched** (about 93%). Of the 194 drafted claims, **182** cite a matched paragraph and **12** do not.

**What the reviewer sees** (`ClaimReviewList.tsx`, strings in `messages/ar.json` → `admin.claims`):

- Matched: «مطابقة آلية محتملة: ج… ص… — تحقّق منها» ("probable automatic match: vol. …, p. … — verify it")
- Not matched: «لم تُطابَق — يجب التحقق قبل النشر» ("not matched — must be verified before publication"), with a warning icon

Every claim is imported with `needs_samarrai_check = true`, **even when a match exists**. An automatic match is treated as a lead to check, never as a confirmation.

**What the visitor sees.** Citations under guide answers and journey stops show the Dar al-Kutub al-'Ilmiyya vol/page. When a match exists they add the critical-edition reference, for example "al-Samarrai ed., vol. 3, p. 139" (`GuideChat.tsx`, `StopView.tsx`). 23 of the 27 claims verified so far carry this reference.

Limitation: the flag is advisory. Approving a claim does not yet require the reviewer to tick "checked in al-Samarrai", and the database does not record that check. All 27 verified claims still have `needs_samarrai_check = true` (section 16).

---

## 5. How claims are extracted

A **claim** is one sentence the product may say about history or religion. Each one is stored with the following fields (`claims` table, migration 006):

- `text_ar`: the statement in plain modern Arabic. `text_en` holds its English.
- `source_id`, `vol`, `page`: where the statement comes from.
- `quote_ar`: a short excerpt copied **verbatim** from that page.
- `samarrai_ref` and `needs_samarrai_check`: the critical-edition cross-check.
- `hadith_ref` and `grading`: filled only when the passage itself states them.
- `content_level` (A/B/C), `kind` (fact / virtue / humane / practical) and `themes`: classification.
- `status` (pending / verified / rejected), `reviewer_note`, `reviewed_at`: the review record.

**Pipeline.**

1. **Corpus.** `build_wafa_corpus.py` writes `.cache/wafa/<place>.json`: numbered paragraphs with headings, printed vol/page and the al-Samarrai match.
2. **Drafting, outside the visitor path.** Claude, an AI assistant used in the development pipeline, read the numbered paragraphs for each place. It drafted claims into `content/claims/<place>.json`, each pointing at one paragraph number and carrying a verbatim excerpt. The drafts are to be written **from the given paragraphs only, never from the model's memory**. The excerpt check in section 6 enforces part of this mechanically: a claim whose excerpt is not in its cited paragraph cannot be imported. Whether the claim text adds anything beyond its excerpt is left to human review.
3. **Earlier pass.** `scripts/extract-claims.ts` does the same job with Gemini. It was used in M1. Five Quba claims from that test run remain in the database: four were approved (C1, C2, C3, C22) and one was rejected (C14). C1, C2 and C3 were rejected on 6 October (section 15.1), so C22 is the only one still verified. Since M2, drafting is done offline as above, and Gemini runs only on the visitor path (guide and planner).

**Drafting rules** (written out in the extraction prompt in `scripts/extract-claims.ts`; the Claude drafts follow the same schema):

- No knowledge from outside the given paragraphs.
- Faithful paraphrase, with no additions, exaggeration or generalisation.
- Opinions and disputes are attributed and marked level C («ذكر السمهودي…»، «قال ابن النجار…»، «اختُلف في…»).
- Descriptions of a place in the author's time are kept in historical form.
- `hadith_ref` only when the paragraph names who narrated the hadith; `grading` only when the paragraph states it.
- A *virtue* only when a hadith or report in the paragraph states it.
- Nothing that amounts to a personal ruling (level D).

**What the 194 repo drafts contain:**

- Levels: A 63, B 66, C 65.
- Kinds: fact 137, humane 34, virtue 16, practical 7.
- 94 carry a hadith or report reference, and 14 carry a grading stated in the text (for example «بسند جيد», «حسن غريب», «قال الترمذي: حسن صحيح»).
- Excerpts are 47–247 characters long (median 133).
- Every draft also has an English `text_en`.

---

## 6. Verbatim-quote validation

The core rules run twice: `python scripts/content/validate_claims.py <place…>` locally, then again inside `scripts/import-claims.ts` before anything reaches the database:

- The cited paragraph must exist in the corpus.
- The excerpt must be at least 20 characters long and must appear **inside that paragraph**. The comparison ignores diacritics, punctuation, alef forms and alef maqsura/ya; the words themselves must match exactly.
- `kind` and `content_level` (A, B or C only; D is rejected) must come from the allowed lists, and `text_ar` must be present. The Python validator also checks `themes` against the allowed list and requires `text_en`.
- Failing drafts are **reported and skipped, never "fixed"**.
- The importer skips a draft that quotes the same passage as an already reviewed (verified or rejected) claim, so the reviewer's decision stands. One Quba draft was skipped this way.
- Valid claims are inserted with `status = 'pending'`. The volume, page and al-Samarrai reference come from the corpus, not from the draft.

All 194 repo drafts pass the validator (re-run on 6 October 2026).

The check proves that every claim is anchored to a real sentence on a real page. It does **not** prove that the paraphrase is faithful or that the excerpt was read in context. Human review exists for that, and section 15.1 shows a case where context mattered.

---

## 7. Human review in `/admin/claims`

### 7.1 Who approves

The **project owner** approves claims. Access requires Supabase Auth plus the `admin_users` allowlist. Writes are allowed only when `is_admin()` is true, as enforced by RLS. No claim, journey stop or quiz item is published automatically. **An independent scholar's review of everything approved during the challenge is planned for after the challenge** (section 16).

### 7.2 What the reviewer sees and checks

Each claim card (`ClaimReviewList.tsx`) shows:

- the claim text, editable
- its English translation
- the verbatim excerpt
- the cited volume and page, linked to the Turath book
- the al-Samarrai status (section 4)
- the hadith reference and grading, if any
- the content level, kind and themes
- a field for a reviewer note

The reviewer checks:

1. **Faithfulness.** Does the Arabic claim say only what the excerpt and its page say, with no addition or generalisation? Open the Turath page when the context matters.
2. **Critical edition.** Confirm the passage in al-Samarrai's edition, which is mandatory when the card says «لم تُطابَق».
3. **Hadith.** Is the narrator or collector stated as in the text, and is any grading quoted as al-Samhudi gives it?
4. **Level.** Is it A, B or C? Is every disputed or attributed statement marked C and attributed?
5. **English.** Does the English say the same thing? It is approved **together with** the Arabic: approval sets `en_reviewed = true`. The exception is a card the reviewer edited before approving. The console then saves the edited text, and `en_reviewed` stays `false`, so that English stays hidden on English pages (`claims/actions.ts`).

The reviewer can then approve (optionally after editing the text and adding a note), reject, or send the claim back to pending. Bulk approval of ticked claims also exists. Approving a journey stop can approve its still-pending cited claims in the same step (`/admin/journeys`). Any cited claim that is not verified stays hidden from visitors by RLS. Every approval refreshes the whole site in both languages (`revalidateSite()`).

### 7.3 Current counts

| Status | Count | How obtained |
|---|---|---|
| In the database | **198**: 193 imported from the 194 repo drafts, plus 5 left from the earlier Gemini test (C1, C2, C3, C22, C14) | Database count by status, 6 Oct 2026 (`select status, count(*) from claims group by status;`) |
| **Verified** (visible to visitors) | **27** | Same count. Anyone can reproduce it: `GET /rest/v1/claims?select=id` with the public anon key returns verified claims only |
| Pending | **167** | Same count |
| Rejected | **4**: C14 (from the Gemini test), and C1, C2, C3 (rejected on 6 October, section 15.1) | Same count |

The 27 verified claims were approved on 5 October 2026 and cover the places of the published Hijra journey: Masjid Quba 8, Masjid al-Jumu'ah 8, the Prophet's Mosque (topic claims) 6, Masjid Bani Unayf 5. By level: A 15, B 6, C 6. 26 have a reviewed English translation; the other one is C22, the remaining early test claim, which has no English. The Hijra journey is published with 4 reviewed stops and 3 reviewed quiz items. The other four journeys are drafted but not yet published; they are reviewed in `/admin/journeys`.

---

## 8. Where verified claims are used

- **Database guarantee.** The RLS policy "public read verified claims" (migration 006) lets visitors read a claim only if `status = 'verified'` and its place is published, or it belongs to no place. Migration 008 also limits the visitor's column grant so `reviewer_note` stays internal. Every public read in the app uses the anon key, so a pending claim cannot leak through any page.
- **Journeys** (`/journeys`). Stop narration, children's versions, human moments, reflections and quiz items were drafted **from the claims only**. `scripts/content/validate_journeys.py` checks that every stop cites only claims available for that stop. Each sentence then went through two independent AI review passes (factual support; scholarly care) before human review in `/admin/journeys`. Each stop lists its sources (vol/page, al-Samarrai reference).
- **Trip planner** (`/plan`). When a place has verified claims, its stop shows one of them with its vol/page, chosen in code (humane or virtue first, level A first; `getPlannerPlaces` in `src/lib/queries.ts`). The plan itself contains no generated text.
- **Human stories** (`/stories`, M6). The page lists verified claims of kind `humane`, grouped by theme, each with its vol/page and its place (`src/lib/stories.ts`). English shows only claims with a reviewed translation. Today 6 of the 27 verified claims are `humane`.
- **AI guide.** See section 9.

---

## 9. The AI guide: verified claims only, or a refusal

Gemini (free tier) runs the guide, with a fallback chain of models when one is busy. Its knowledge is assembled in code before each call, and its answer is checked in code afterwards.

1. **Context in code** (`src/lib/guide/context.ts`). The context holds the verified claims for the current place, the journey's places or the two nearest places, each on its own line tagged `[C<id>]` with its level, kind and hadith reference. It also holds **practical facts**: distances and walking and driving times computed in code, and opening hours, stairs, transport and fares from the place records. Distances are never left to the model, and it is told to use no other knowledge.
2. **Instructions** (`src/lib/guide/prompt.ts`, Arabic and English versions with the same rules). They tell the model to:
   - use no other knowledge, even if it knows it
   - end every historical or religious sentence with the `[C<id>]` that supports it
   - present level C matters as attributed views without settling them
   - never quote a hadith, verse or scholar's words unless the text is in the facts, and never compose one
   - give general information only for personal rulings, then refer the visitor
   - avoid asking about or assuming the visitor's religion
3. **Server guard** (`guardAnswer` in `src/lib/guide/answer.ts`). It judges the content, not the model's own label:
   - Citations are normalised, and **any ID that was not in the context is deleted**.
   - A historical or religious answer with **no valid citation is replaced by the refusal**, in Arabic «لا أملك مصدرًا موثقًا لهذا في المصادر المحققة لدى المنصة، ولا أريد أن أخمّن في أمر يتعلق بالسيرة.» and in English "I don't have a verified source for this in the platform's reviewed sources, and I won't guess about the Seerah."
   - A refusal or referral always carries the referral line to the official guidance of the Two Holy Mosques, **<https://risala.prh.gov.sa>**. The same line points site questions to the project's Telegram channel.
   - An uncited "practical" answer is accepted only when the question matches the practical-question patterns in `answer.ts`.
   - The guard checks that an answer has at least one valid citation. It does not prove that every sentence is supported by the claim it cites.
   - The answer streams to the screen while it is written. The guard runs when the stream ends, and its result replaces the streamed text. A visitor can therefore glimpse an uncited draft for a few seconds before it turns into the refusal.
4. **Shown to the visitor.** Every cited answer lists its sources: book, vol/page, al-Samarrai reference, and hadith reference with grading. An AI disclosure above the chat says it may make mistakes.
5. **Tests.** `src/lib/guide/answer.test.ts` holds 14 tests covering invented IDs, uncited answers, practical-question detection, referrals and both languages. They test the guard, not the model's answers. Run them with `npm test` (39 tests in all, with the planner's).
6. **Logs.** Each call is logged anonymously in `guide_logs`: question, answer, cited IDs, refused flag, model, tokens and latency. No IP address or user ID is stored, as the privacy page says. The IP is used only in memory, for a per-minute rate limit.

---

## 10. Content levels A–D

The levels follow the organizers' scientific package (p. 2) and are stored as the `content_level` enum.

| Level | Package definition (p. 2) | How we handle it |
|---|---|---|
| **A**: settled core information | Answer directly from the documented source | Claim stated plainly with its citation. The planner prefers level A when it picks a stop's fact |
| **B**: explanation and reasoning | Answer from approved material, show the reference, avoid categorical statements where dispute is possible | Context or explanation claim, always cited |
| **C**: disputed or highly sensitive | Answer limited to what is approved, state that a dispute exists, or refer to a specialist | The claim text itself attributes the view («ذكر السمهودي…»، «اختلفت الروايات…»). The guide is told to present the views and their holders without settling them. Reviewers check that every C claim is attributed |
| **D**: fatwa or personal case | Give no independent ruling; give general information and refer to a qualified body | **Never stored**: the validator and importer reject level D. In the guide, personal-ruling questions (marriage, divorce, transactions, medical or legal matters) get general information if it is in the facts, plus the referral to risala.prh.gov.sa |

---

## 11. Quran and hadith handling

**Quran**

- In claims, a verse appears only as al-Samhudi quotes it, with the surah and ayah as printed in the edition (for example «[التوبة ١٠٨]»).
- The guide is instructed not to quote a verse unless its text is among the verified facts.
- On English place pages, quoted verses use the Saheeh International translation, carry surah:ayah and are labelled "translation of the meaning", for example "Surah At-Tawbah 9:108 (translation of the meaning: Saheeh International)".

**Hadith and reports**

- `hadith_ref` names the collector or narrator **only as the passage states it**, for example «رواه الطبراني عن عمرو بن عوف المزني».
- `grading` is filled only when al-Samhudi states it, and is quoted as he gives it, for example «رجاله ثقات», «بسند جيد». No grading is inferred.
- The guide shows the reference and grading under every answer that uses the claim. It is instructed to refuse requests for a hadith that is not in the facts; the scientific package (p. 6) lists this exact test case.
- In English, hadith keep their narrator and source.

**Not done yet**

- Many hadith claims carry a reference without a grading (14 of 94 drafts have one). Checking them against dorar.net/hadith or the approved Sunnah editions, as the package recommends (pp. 3, 15), is a next step.
- Verse text is not yet checked against the King Fahd Complex Unicode Quran text (package p. 14).
- We have not yet confirmed that the Saheeh International translation is on the approved list (King Fahd Complex or quranpedia.net, package p. 3). If it is not, the planned fix is to switch to an approved translation.

---

## 12. English translation

- **Interface, place and route texts.** 471 texts were translated, during development and with AI assistance, in three passes: **translate → faithfulness check against the Arabic → English style edit**. The passes followed the scientific package:
  - Quran from a published translation of the meanings, with surah:ayah
  - hadith keep narrator and source
  - Arabic hedges are kept («قيل», «يُروى» become "it is said", "it is reported")
  - the package's glossary terms are kept, such as Tawhid, Hadith and Sunnah (p. 7); Seerah is kept as a term too
- **Hash stamping.** Each English place or route text in `content/i18n/en.json` stores a hash of the Arabic it was translated from (`sourceHash` in `src/lib/i18n-content.ts`). `scripts/i18n/assemble-en.mts` writes the hashes. If the Arabic is edited later, the hash no longer matches and **the stale English is hidden** instead of shown. Place names fall back to the stored English name, then to the Arabic.
- **Claims** appear on English pages only when their translation was reviewed (`claimText`: `en_reviewed && text_en`). Otherwise the English page hides them.
- **Guide in English.** On English pages the guide translates the verified Arabic facts that have no reviewed English. The page says so: "In English, the guide translates the reviewed Arabic facts itself; only some of them have a reviewed translation."
- **Journeys.** The English is drafted with the Arabic and reviewed with the stop. The children's version is Arabic only.
- **Disclosure.** English place, tour, journey, stop and story pages state: "Translated from the reviewed Arabic text. The English translation has not yet had a scholar's review."

**Status: the English translation awaits scholarly review.** Section 16 lists the known gap for edited claims.

---

## 13. Alignment with the organizers' scientific package

Page numbers refer to «المرجعية والحزمة العلمية والبيانات» (15 pp.).

| Package requirement | Page | How Mazarat Madinah meets it | Status |
|---|---|---|---|
| Scope excludes independent fatwa and rulings on persons | 2 | No level D content; personal-ruling questions referred to risala.prh.gov.sa | Built |
| Content levels A–D with prescribed handling | 2 | `content_level` enum and the handling in section 10 | Built |
| Quran: approved text and translations; verify verse accuracy | 3 | Verses only as quoted by the source or on curated place pages, with surah:ayah; guide instructed never to compose verses | Partly: translation list and verse-text checks pending (section 11) |
| Hadith: no hadith attributed without source and approved grading | 3 | References only as stated in the source; grading quoted, never inferred; guide shows both | Partly: gradings for many references pending |
| Seerah and history: sources of the first three centuries or dorar.net/history; rely on established facts and state the degree of caution | 4 | *Wafa al-Wafa* is a 9th-century compilation, but it attributes its reports to earlier sources (e.g. Ibn Zabala, Ibn Shabba). Attributions are kept in the claims, and disputes are level C | Partly: cross-checking key claims against dorar.net/history planned |
| Authenticity and attribution: every claim traceable; nothing attributed to a source that lacks it; say when information is insufficient | 5 | Vol/page and a verbatim excerpt for every claim; server-validated citations; refusal when unsourced | Built |
| Distinguish settled from disputed matters | 5 | Level C with attribution; guide does not settle disputes | Built |
| No independent fatwa | 5 | Referral (section 10) | Built |
| Hallucination resistance: refuse, hedge or refer rather than generate | 5 | Server guard replaces uncited answers with the refusal (section 9) | Built |
| Translation keeps the legal meaning of terms | 5, 7 | Glossary terms kept; faithfulness pass; English hidden when stale | Built; scholarly review pending |
| Transparency: discloses it is an AI tool | 5 | AI disclosure above every chat, in both languages | Built |
| Privacy: no personal data beyond need | 5 | Anonymous logs; location rounded to about 100 m before sending; opt-in, anonymous quiz results; privacy page | Built |
| Test cases (fabricated hadith request, personal fatwa, Tawhid in English…) | 6 | Guide rules 2–4 and 7 plus the guard; unit tests for the guard | Built |
| Official religious guidance platform | 11 | risala.prh.gov.sa is the referral target | Built |

Participant guide judging criteria (pp. 37–38): *reliability and scholarly soundness* (15%) asks about "the soundness of content and sources, and how well attribution, refusal and referral work where they are required". Sections 6–10 answer that question. Section 16 describes the content review responsibilities after the challenge, which *operational realism and completeness* (p. 40) also asks about.

---

## 14. Register of sources, tools and licences

| Item | Used for | Rights and notes |
|---|---|---|
| *Wafa al-Wafa*, Dar al-Kutub al-'Ilmiyya ed. 1419 AH, text via Turath (book 23695) | Text every claim quotes and cites | Downloaded by the corpus script from Turath's public endpoints into a git-ignored cache (`.cache/`). Only short excerpts (47–247 characters) are stored with each claim and shown as citations |
| *Wafa al-Wafa*, ed. Qasim al-Samarrai (Al-Furqan) | Cross-check and critical-edition page reference | The owner's private OCR'd copies of scans; never committed or redistributed. Only vol/page references are published |
| Sahih al-Bukhari, Sahih Muslim, Sunan al-Nasa'i, Sunan Ibn Majah, Musnad Ahmad, al-Tabarani's *al-Mu'jam al-Kabir*, Ibn Shabba, Ibn Hisham, Ibn Sa'd | Hadith and reports cited on place pages (written before the challenge) | Cited by collection or book name on the page |
| Saheeh International | English translation of the meanings of quoted verses | Quoted briefly with attribution; rights remain with the publisher |
| Gemini (Google) | **Visitor path only:** guide answers (from verified claims) and reading planner requests into structured answers | Free tier; quotas apply. Questions are sent to Google, as the privacy page states |
| Claude (Anthropic) | **Development only:** drafting claims, journey texts and translations, and code | Never called at request time. Claims and journey texts reach visitors only after human review. Interface, place and route translations went through AI faithfulness and style passes and are labelled as awaiting scholarly review |
| Original photos and videos | Place media | Shot on site by the owner; all rights reserved (`README.md`) |
| Map | OpenStreetMap data, OpenFreeMap tiles, MapLibre GL JS | Credits and licences in `README.md` |
| Software stack | Next.js 15, React 19, Supabase, Vercel, Cloudflare R2 | Open-source or hosted services under their own licences; see `package.json` and `README.md` |
| Typeface (thmanyah) | Site font | Proprietary; self-hosted with written permission for this site only, and not covered by the repository's licence (`README.md`) |
| Project code | — | No open-source licence chosen yet; all rights reserved by the team (`README.md`) |

---

## 15. Checking these claims yourself

- **Public data:** with the site's public anon key, `GET <supabase>/rest/v1/claims?select=id,text_ar,vol,page,quote_ar,samarrai_ref,status` returns only `verified` rows. Pending claims are not readable.
- **Citations:** open any guide answer or journey stop, take the vol/page and read the passage at <https://app.turath.io/book/23695>.
- **Refusal:** ask the guide for a hadith or a fact that is not in the sources, for example the virtue of a place that has no verified claims. It should answer with «لا أملك مصدرًا موثقًا لهذا…» and the referral line.
- **Referral:** ask a personal-ruling question (for example about marriage in your country). The guide should give no ruling and should refer to risala.prh.gov.sa.
- **Validation:** `python scripts/content/validate_claims.py masjid-quba` re-checks every draft's excerpt against the corpus. Building the corpus first takes `python scripts/content/build_wafa_corpus.py`. Without the al-Samarrai scans, which are not public, every paragraph stays flagged as unmatched.
- **Guard tests:** `npm test`.

### 15.1 Known content issue found while writing this document (resolved 6 October)

Four claims (C1, C2, C3 and C22, all about Masjid Quba) came from the early Gemini extraction test and were approved before the Claude-drafted pipeline existed. Re-reading their source on 6 October 2026 showed that **C1, C2 and C3 cite vol. 1 p. 66**. That page is al-Samhudi's numbered list of Madinah's merits. The items behind C1 and C2 refer to **the Prophet's Mosque**, and the item behind C3 does not name Quba:

- **C1** describes a reward "like a Hajj". The list item concerns the Prophet's Mosque. The Quba hadith, which al-Samhudi gives in vol. 3 p. 18, has "like the reward of an 'Umrah".
- **C2** concerns the Prophet ﷺ founding "its noble mosque", that is, Madinah's mosque.
- **C3** treats the identification of the "mosque founded on piety" as settled for Quba. The passage does not say that, and the identification is a known dispute, so it would be level C at most.

The corpus builder's 60-character minimum dropped the short line that introduces item 22, which helped cause the misreading.

**Corrected:** on 6 October 2026 (08:20 Riyadh) the owner rejected C1, C2 and C3, with a reviewer note giving this reason. They are no longer shown to visitors or given to the guide. C2 and C3 were among the sources of the first (Quba) stop of the published Hijra journey; that stop no longer lists them, and 26 of the journey's 28 cited claims remain verified. The stop's narration presents the "founded on piety" identification as disputed. The two guide-evaluation cases that had cited C1 (F04, Q01) were re-run and now pass ([docs/EVAL.md](docs/EVAL.md)).

---

**Hijra journey, Quba stop — re-checked after the rejection.** C2 and C3 were among the stop's cited claims. Every sentence of the stop was re-read against its remaining verified claims (C184, C185, C186, C189, C192, C200, C203). One sentence relied on C2 alone ("he worked on it himself with the Muhajirun and the Ansar"); it was narrowed to what C200 supports ("…with his Companions") in Arabic and English, in the database and in `content/journeys/hijra.json`.

## 16. Known limitations

- **Reviewer.** Today the owner approves every claim; no independent scholar has reviewed the content yet. Visitor-facing texts say exactly that: the guide disclosure and the stories page say material is shown "only after review" («بعد المراجعة»), and the guide's instructions say the facts were "approved after human review" (changed on 6 October; they previously said "reviewed by a specialist"). A scholar's review of everything approved is planned after the challenge.
- **Coverage.** 27 of 198 claims are verified, all on the Hijra journey's places. Places and journeys without verified claims get refusals from the guide by design.
- **Advisory critical-edition flag.** Approval does not require or record the al-Samarrai check. 12 drafted claims cite passages with no automatic match.
- **Context loss in the corpus.** Paragraphs under 60 characters (mostly headings) are dropped, which can separate a sentence from its subject (section 15.1). Reviewers should open the Turath page whenever an excerpt starts mid-thought.
- **Edited claims and their English.** If a reviewer edits a claim before approving it, its English stays hidden on English pages (`en_reviewed = false`). The console has no step yet to re-translate and re-approve that English. Saving a reviewer note also counts as an edit.
- **Citation guard granularity.** The guard checks that each history answer cites at least one real claim from its context. It does not check that every sentence is supported, and the streamed draft is visible until the guard's result replaces it (section 9).
- **Hadith gradings and verse text.** These are not yet checked against dorar.net/hadith or the King Fahd Complex text (section 11).
- **Seerah sources.** The package (p. 4) prefers sources from the first three centuries or dorar.net/history. Our single source is a later compilation that attributes earlier reports, and we have not yet cross-checked it against those references.
- **Small user sample.** The before/after quiz is the user-study instrument. Results are anonymous and opt-in. By 6 October 2026 one result had been submitted, so no learning gain can be claimed yet.
- **Free-tier AI.** Gemini quotas and capacity errors can slow the guide or make it unavailable. The fallback models reduce this but do not remove it. When the model fails before writing a usable answer, the visitor gets a clean "unavailable" message. A partial answer is judged by the guard like any other.

## 17. Next steps

1. **Scholar review** of every verified claim, journey text and the English translation, with the reviewer named in the documentation and the guide disclosure.
2. **A "checked in al-Samarrai" control** in the review console that clears `needs_samarrai_check`, and stops approval of unmatched claims without it.
3. **Re-translation step for edited claims**, so a claim whose English was hidden after an edit can get a new English and be approved again.
4. **Hadith gradings** from dorar.net/hadith for every claim that carries a reference. **Verse text** validated against the King Fahd Complex Unicode Quran. The **English Quran translation** switched to, or confirmed on, an approved list.
5. **Corpus fix:** keep short heading lines attached to the paragraph that follows, so excerpts keep their subject.
6. **Continue review** of the 4 drafted journeys and the 167 pending claims. Expand to more places with the same pipeline.
