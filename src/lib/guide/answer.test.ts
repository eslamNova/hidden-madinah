import { test } from "node:test";
import assert from "node:assert/strict";
import { guardAnswer, isPracticalQuestion, normaliseCitations, parseAnswer, replyLanguage } from "./answer";
import { REFERRAL_LINE, REFUSAL, RELIGIOUS_REFERRAL, UNAVAILABLE, systemPrompt } from "./prompt";
import type { Lang } from "@/lib/i18n";

const allowed = new Set([12, 15, 40]);
const refusal = (lang: Lang) => `${REFUSAL[lang]}\n${REFERRAL_LINE[lang]}`;

test("reply language: Arabic pages keep the original rule", () => {
  assert.equal(replyLanguage("ما قصة هذا المكان؟"), "ar");
  assert.equal(replyLanguage("What is the story of this place?"), "en");
  assert.equal(replyLanguage("ما قصة Quba؟", "ar"), "ar");
  // A tie (digits or punctuation only) is Arabic on Arabic pages…
  assert.equal(replyLanguage("123؟", "ar"), "ar");
  // …and English on English pages.
  assert.equal(replyLanguage("123?", "en"), "en");
});

test("reply language: English pages answer Arabic questions in Arabic", () => {
  assert.equal(replyLanguage("How far is Quba?", "en"), "en");
  assert.equal(replyLanguage("كم يبعد قباء؟", "en"), "ar");
  assert.equal(replyLanguage("Where is مسجد قباء exactly?", "en"), "en");
});

test("practical questions: the Arabic list is unchanged", () => {
  for (const q of ["كم يبعد الموضع التالي؟ هل أمشي؟", "هل يناسب كبار السن؟", "هل هو مفتوح الآن؟", "كم أجرة التاكسي؟", "هل فيه درج؟"]) {
    assert.ok(isPracticalQuestion(q), q);
  }
  for (const q of ["ما قصة هذا المكان؟", "من بنى المسجد أول مرة؟"]) {
    assert.ok(!isPracticalQuestion(q), q);
  }
});

test("practical questions in English", () => {
  const practical = [
    "How far is the next site? Should I walk?",
    "Is it suitable for older people?",
    "Is it open now?",
    "What time does it close? When does it close?",
    "What are the opening hours?",
    "Are there stairs?",
    "Is it wheelchair accessible?",
    "How much is a taxi from the Prophet's Mosque?",
    "What does a taxi cost?",
    "Where can I park?",
    "How long does it take to get there?",
    "How much time do I need here?",
    "How do I get there from my hotel?",
    "Is it close to the Prophet's Mosque?",
    "How close is the next stop?",
    "Can I go on foot?",
    "What is the nearest place to me?",
    "Is it crowded on Fridays?",
    "When should I visit?",
    "What's the best time to visit?",
    "Is it OK with kids?",
    "Can I visit with children?",
    "Is there an entrance fee?",
    "Give me directions",
  ];
  for (const q of practical) assert.ok(isPracticalQuestion(q), q);
});

test("history questions in English are not practical", () => {
  const history = [
    "What is the story of this place?",
    "How long did the Prophet ﷺ stay in Quba?",
    "Who walked with him on the Hijra?",
    "Why did the qibla direction change?",
    "Tell me about his entry into Madinah",
    "Who took care of him as a child?",
    "What happened nearly a year later?",
    "Who was buried here?",
    "Is there a hadith about the virtue of this mosque?",
    // Transport, price and opening words inside a question about the past.
    "Did the Prophet walk to Quba?",
    "Was the mosque open to women in the Prophet's time?",
    "Did the Ansar ride out to meet him?",
    "What price did the Prophet pay for the land?",
  ];
  for (const q of history) assert.ok(!isPracticalQuestion(q), q);
});

test("visit phrasings stay practical even next to a history word", () => {
  for (const q of ["How far is it from where the Prophet prayed?", "Can I walk to the Prophet's Mosque from here?", "Is it open on Friday?", "Can we take a taxi from the Haram?"]) {
    assert.ok(isPracticalQuestion(q), q);
  }
});

test("parsing: markers and grouped citations", () => {
  assert.deepEqual(parseAnswer("Built by the Ansar [C12].\n**<<type:answer>>**."), {
    type: "answer",
    body: "Built by the Ansar [C12].",
  });
  assert.equal(parseAnswer("Some text <<type:pract").body, "Some text");
  const n = normaliseCitations("A [C12, C15] and B [C99].", allowed);
  assert.equal(n.text, "A [C12][C15] and B.");
  assert.deepEqual(n.valid, [12, 15]);
  assert.deepEqual(n.invented, [99]);
});

test("guard: a cited answer passes in both languages", () => {
  for (const lang of ["ar", "en"] as const) {
    const g = guardAnswer({ raw: "Quba was the first mosque [C12].\n<<type:answer>>", question: "What is Quba?", allowed, lang });
    assert.equal(g.type, "answer");
    assert.equal(g.text, "Quba was the first mosque [C12].");
    assert.deepEqual(g.valid, [12]);
  }
});

test("guard: an uncited or invented-only answer becomes the refusal in the reply language", () => {
  const uncited = guardAnswer({ raw: "He stayed fourteen nights.\n<<type:answer>>", question: "How long did he stay?", allowed, lang: "en" });
  assert.deepEqual(uncited, { type: "refuse", text: refusal("en"), valid: [] });
  const invented = guardAnswer({ raw: "قيل كذا [C999].\n<<type:answer>>", question: "كم مكث؟", allowed, lang: "ar" });
  assert.deepEqual(invented, { type: "refuse", text: refusal("ar"), valid: [] });
});

test("guard: an uncited practical reply is kept only for a practical question", () => {
  const ok = guardAnswer({ raw: "About 3.4 km — take a taxi.\n<<type:practical>>", question: "How far is it? Should I walk?", allowed, lang: "en" });
  assert.equal(ok.type, "practical");
  assert.equal(ok.text, "About 3.4 km — take a taxi.");
  const sneaky = guardAnswer({ raw: "He prayed here at dawn.\n<<type:practical>>", question: "What did the Prophet do here?", allowed, lang: "en" });
  assert.deepEqual(sneaky, { type: "refuse", text: refusal("en"), valid: [] });
});

test("guard: the model's own refusal is replaced by the canonical wording", () => {
  // The model refused in Arabic on an English page for an English question: English wins.
  const g = guardAnswer({ raw: "لا أعلم.\n<<type:refuse>>", question: "Who built it?", allowed, lang: "en" });
  assert.deepEqual(g, { type: "refuse", text: refusal("en"), valid: [] });
});

test("guard: a referral always carries the official link", () => {
  const added = guardAnswer({ raw: "Please ask a scholar about your case.\n<<type:refer>>", question: "Is my prayer valid?", allowed, lang: "en" });
  assert.equal(added.type, "refer");
  assert.equal(added.text, `Please ask a scholar about your case.\n${REFERRAL_LINE.en}`);
  const kept = guardAnswer({ raw: `See ${RELIGIOUS_REFERRAL}\n<<type:refer>>`, question: "Is my prayer valid?", allowed, lang: "en" });
  assert.equal(kept.text, `See ${RELIGIOUS_REFERRAL}`);
});

test("guard: identical decisions in both languages", () => {
  const replies: [string, string][] = [
    ["Fact [C12].\n<<type:answer>>", "What happened here?"],
    ["Fact [C77].\n<<type:answer>>", "What happened here?"],
    ["No ids here.\n<<type:answer>>", "What happened here?"],
    ["3 km.\n<<type:practical>>", "How far is it?"],
    ["3 km.\n<<type:practical>>", "Who built it?"],
    ["Ask a scholar.\n<<type:refer>>", "Is it permissible?"],
    ["…\n<<type:refuse>>", "Anything"],
    ["Cut off mid-way <<type:ans", "Anything"],
  ];
  for (const [raw, question] of replies) {
    const ar = guardAnswer({ raw, question, allowed, lang: "ar" });
    const en = guardAnswer({ raw, question, allowed, lang: "en" });
    assert.equal(ar.type, en.type, raw);
    assert.deepEqual(ar.valid, en.valid, raw);
    if (ar.type === "refuse") {
      assert.equal(ar.text, refusal("ar"));
      assert.equal(en.text, refusal("en"));
    }
  }
});

test("prompt: Arabic is the default; English carries the English refusal and referral", () => {
  assert.equal(systemPrompt("F", "P"), systemPrompt("F", "P", "ar"));
  assert.ok(systemPrompt("F", "P").includes(REFUSAL.ar));
  const en = systemPrompt("[C12] fact", "practical line", "en");
  assert.ok(en.includes(REFUSAL.en));
  assert.ok(en.includes(REFERRAL_LINE.en));
  assert.ok(en.includes("[C12] fact"));
  assert.ok(en.includes("practical line"));
  assert.match(en, /<<type:answer>>/);
  assert.ok(UNAVAILABLE.en && UNAVAILABLE.ar);
});
