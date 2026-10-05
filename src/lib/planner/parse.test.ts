import { test } from "node:test";
import assert from "node:assert/strict";
import { malformedFields, normaliseMinutes, parseRequestFallback as parse, sanitizeParsed } from "./parse";

test("the proposal's example", () => {
  const p = parse("معي ثلاث ساعات بعد العصر، ومعي والدتي وتصعب عليها المشي الطويل، ويهمنا مواضع السيرة القريبة من قباء");
  assert.equal(p.minutes, 180);
  assert.equal(p.companions, "elderly");
  assert.equal(p.mobility, "limited");
  assert.equal(p.start, "quba");
  assert.equal(p.mode, "car");
  assert.notEqual(p.mode, "walk");
});

test("time phrases", () => {
  const cases: [string, number | null][] = [
    ["عندي ساعتين ونص", 150],
    ["معي ساعة و نص", 90],
    ["ساعة الا ربع", 45],
    ["ربع ساعة بس", 15],
    ["نص ساعة", 30],
    ["٣ ساعات ونص", 210],
    ["I have 3 hrs", 180],
    ["an hour and a half", 90],
    ["half an hour", 30],
    ["a couple of hours", 120],
    ["two and a half hours", 150],
    ["2 and a half hrs", 150],
    ["two hours and a half", 150],
    ["1.5 hours", 90],
    ["90 minutes", 90],
    ["the whole day", 360],
    ["عندي ساعة", 60],
    ["طول اليوم", 360],
    ["45 دقيقة", 45],
    // Clock times are not durations.
    ["نبدأ الساعة ٤ العصر", null],
    ["بعد الساعه 5", null],
  ];
  for (const [text, minutes] of cases) assert.equal(parse(text).minutes, minutes, text);
});

test("'one' and 'anyone' are not Uhud; Uhud with a qualifier is", () => {
  for (const text of ["معي ساعة واحدة", "ما في احد معي", "يوم الأحد"]) {
    const p = parse(text);
    assert.notEqual(p.start, "uhud", text);
    assert.ok(!p.interests.includes("battles"), text);
  }
  assert.equal(parse("نحن قرب جبل أحد").start, "uhud");
  assert.ok(parse("نحب نشوف موقع غزوة أحد").interests.includes("battles"));
  assert.equal(parse("near Uhud").start, "uhud");
});

test("kinship words need whole words", () => {
  assert.equal(parse("أبي أزور مساجد جديدة").companions, null); // أبي = "I want", جديدة ≠ جدي
  assert.equal(parse("معي الوالدة").companions, "elderly");
  assert.equal(parse("مع جدي وجدتي").companions, "elderly");
  assert.equal(parse("أنا وعيالي").companions, "kids");
  assert.equal(parse("لوحدي").companions, "alone");
  assert.equal(parse("مع أهل المدينة").companions, null);
});

test("negated walking is never a walking plan", () => {
  for (const text of ["ما أقدر أمشي كثير", "ما تقدر تمشي", "لا يستطيع المشي", "can't walk far", "my dad has trouble walking"]) {
    const p = parse(text);
    assert.equal(p.mobility, "limited", text);
    assert.equal(p.mode, "car", text);
  }
  const rather = parse("ما أبي أمشي");
  assert.equal(rather.mode, "car");
  assert.equal(rather.mobility, null, "not wanting to walk is not a mobility limit");
  assert.equal(parse("نبي نمشي").mode, "walk");
  assert.equal(parse("ماشي، عندي ساعتين").mode, null, "ماشي = OK");
});

test("substring false positives", () => {
  assert.ok(!parse("mosques as well").interests.includes("wells_gardens"));
  assert.equal(parse("القرآن الكريم").mode, null);
  assert.equal(parse("I take care of my kids").mode, null);
  assert.equal(parse("بير كبير").interests.length, 1);
  assert.equal(parse("مع كريم").mode, "car");
});

test("a start point is not an interest; the cued place is the start", () => {
  const p = parse("قريب من المسجد النبوي");
  assert.equal(p.start, "nabawi");
  assert.deepEqual(p.interests, []);
  assert.equal(parse("من الحرم إلى قباء").start, "nabawi");
  assert.equal(parse("نبي نروح قباء ونحن ساكنين عند الحرم").start, "nabawi");
});

test("minutes are clamped and snapped", () => {
  assert.equal(normaliseMinutes(0), null);
  assert.equal(normaliseMinutes(-5), null);
  assert.equal(normaliseMinutes(Number.NaN), null);
  assert.equal(normaliseMinutes(7), 15);
  assert.equal(normaliseMinutes(122), 120);
  assert.equal(normaliseMinutes(5000), 720);
  assert.equal(sanitizeParsed({ minutes: 99999 }).minutes, 720);
});

test("only malformed AI fields are filled from keywords", () => {
  const explicitUnknown = { minutes: 0, companions: "unknown", mobility: "unknown", interests: [], start: "unknown", mode: "unknown" };
  assert.equal(malformedFields(explicitUnknown).size, 0);
  const bad = malformedFields({ minutes: "two", companions: "grandma", interests: ["food"], start: "quba" });
  assert.deepEqual([...bad].sort(), ["companions", "interests", "minutes", "mobility", "mode"]);
});

test("English requests (the /en planner)", () => {
  const p = parse("I have three hours after Asr, my mother is with me and she can't walk far, we'd like Seerah sites near Quba");
  assert.equal(p.minutes, 180);
  assert.equal(p.companions, "elderly");
  assert.equal(p.mobility, "limited");
  assert.equal(p.start, "quba");
  assert.equal(p.mode, "car");
  assert.equal(parse("with mom and dad").companions, "elderly");
  assert.equal(parse("We have 4 hours with the kids, we have a car").companions, "kids");
  assert.equal(parse("I'm staying near the Haram, 2 hours, walking").start, "nabawi");
  assert.equal(parse("I'm staying near the Haram, 2 hours, walking").mode, "walk");
  assert.deepEqual(parse("I like battle sites").interests, ["battles"]);
  assert.equal(parse("starting at 4pm").minutes, null);
});
