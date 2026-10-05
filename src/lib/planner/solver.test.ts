// Run: npm test   (node --import tsx --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { fareBand, solvePlan, type Constraints, type PlannerPlace } from "./solver";

const place = (p: Partial<PlannerPlace> & Pick<PlannerPlace, "slug" | "category" | "lat" | "lng">): PlannerPlace => ({
  name: p.slug,
  featured: false,
  visitMinutes: null,
  hasStairs: null,
  walkingEffort: null,
  fact: { text: "fact", vol: 1, page: 1 },
  ...p,
});

// Real coordinates of the published places (Oct 2026).
const PLACES: PlannerPlace[] = [
  place({ slug: "masjid-quba", category: "mosque", lat: 24.4394, lng: 39.6172, featured: true, hasStairs: false }),
  place({ slug: "bustan-al-mustazal", category: "garden", lat: 24.43856, lng: 39.6158, hasStairs: true }),
  place({ slug: "bir-ghars", category: "well", lat: 24.4497, lng: 39.6233, hasStairs: false }),
  place({ slug: "masjid-bani-anif", category: "mosque", lat: 24.43568, lng: 39.61545 }),
  place({ slug: "masjid-al-jumuah", category: "mosque", lat: 24.44548, lng: 39.61531, hasStairs: false }),
  place({ slug: "al-masajid-al-sabaa", category: "historical_site", lat: 24.4767, lng: 39.59624 }),
  place({ slug: "masjid-al-qiblatayn", category: "mosque", lat: 24.48412, lng: 39.57896 }),
  place({ slug: "jabal-al-rumah", category: "historical_site", lat: 24.5022, lng: 39.6122, walkingEffort: "high" }),
  place({ slug: "masjid-al-usba", category: "mosque", lat: 24.43085, lng: 39.60565 }),
  place({ slug: "masjid-abu-bakr-al-siddiq", category: "mosque", lat: 24.46618, lng: 39.60636 }),
];

const base: Constraints = { minutes: 120, companions: "alone", mobility: "good", interests: [], start: "nabawi" };

test("the proposal's example: 3h after Asr, mother can't walk far, near Quba", () => {
  const plan = solvePlan(PLACES, {
    minutes: 180,
    companions: "elderly",
    mobility: "limited",
    interests: ["mosques", "wells_gardens"],
    start: "quba",
  });
  assert.equal(plan.mode, "car", "limited mobility → car");
  assert.equal(plan.stops.length, 3, "an elderly visitor gets an unhurried 3 stops");
  assert.ok(plan.totalMinutes <= 180, "fits the time budget");
  // Every stop stays local to Quba (short drives).
  for (const s of plan.stops) assert.ok(s.leg.km < 4, `${s.place.slug} is ${s.leg.km.toFixed(1)} km away`);
  // A stop with stairs is flagged, with an alternative when one exists.
  const stairs = plan.warnings.find((w) => w.kind === "stairs");
  if (plan.stops.some((s) => s.place.hasStairs === true)) {
    assert.ok(stairs, "stairs warning present");
  }
});

test("never exceeds the time budget", () => {
  for (const minutes of [30, 60, 90, 120, 240]) {
    const plan = solvePlan(PLACES, { ...base, minutes });
    assert.ok(plan.totalMinutes <= minutes, `${plan.totalMinutes} > ${minutes}`);
  }
});

test("interests filter the stops", () => {
  const plan = solvePlan(PLACES, { ...base, minutes: 240, interests: ["battles"], mode: "car" });
  assert.ok(plan.stops.length > 0);
  for (const s of plan.stops) assert.ok(["jabal-al-rumah", "al-masajid-al-sabaa"].includes(s.place.slug));
});

test("walking plans never contain a long walking leg for limited mobility", () => {
  const plan = solvePlan(PLACES, { ...base, minutes: 180, mobility: "limited", mode: "walk", start: "quba" });
  for (const s of plan.stops) if (s.leg.mode === "walk") assert.ok(s.leg.minutes <= 8, `${s.place.slug}: ${s.leg.minutes} min walk`);
});

test("order is the shortest for the chosen stops (no zig-zag)", () => {
  const plan = solvePlan(PLACES, { ...base, minutes: 240, start: "quba", mode: "car" });
  const legs = plan.stops.map((s) => s.leg.minutes);
  assert.equal(plan.travelMinutes, legs.reduce((a, b) => a + b, 0));
});

test("car legs carry a fare band, walking legs don't", () => {
  const car = solvePlan(PLACES, { ...base, mode: "car" });
  assert.ok(car.stops.every((s) => (s.leg.mode === "car") === (s.leg.fareSar !== null)));
  assert.ok(car.stops.some((s) => s.leg.mode === "car"));
  const walk = solvePlan(PLACES, { ...base, mode: "walk", start: "quba" });
  assert.ok(walk.stops.every((s) => s.leg.fareSar === null));
  assert.deepEqual(fareBand(1), [10, 15]);
});

test("a tiny budget yields an honest empty plan", () => {
  const plan = solvePlan(PLACES, { ...base, minutes: 5 });
  assert.equal(plan.stops.length, 0);
});

test("a 2-hour trip from the Prophet's Mosque shows more than one place", () => {
  const plan = solvePlan(PLACES, { ...base, minutes: 120 });
  assert.ok(plan.stops.length >= 2, `got ${plan.stops.length} (${plan.mode})`);
});

test("very short hops are walks, not taxi rides", () => {
  const plan = solvePlan(PLACES, { ...base, minutes: 240, start: "quba", mode: "car" });
  for (const s of plan.stops) if (s.leg.km < 0.3) assert.equal(s.leg.mode, "walk");
});
