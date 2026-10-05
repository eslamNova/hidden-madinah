import { PROPHETS_MOSQUE, driveMinutes, haversineKm, walkMinutes, type LatLng } from "@/lib/geo";

/**
 * Trip planner core — deterministic, no AI. Given what the visitor told us
 * (time, companions, walking ability, interests, start point) it picks and
 * orders stops, adds travel time and an approximate taxi fare per leg, and
 * explains every compromise (stairs, unknown access, skipped places).
 *
 * Plans are door to door: the way back to the start point counts toward the
 * time the visitor said they have (e.g. back at the Haram for the next prayer).
 *
 * The AI's only job in the planner is turning free text into `Constraints`
 * (src/lib/planner/parse.ts); everything here is testable and repeatable.
 */

export type Interest = "mosques" | "battles" | "wells_gardens";
export type Companions = "alone" | "family" | "elderly" | "kids";
export type Mobility = "good" | "limited";
export type Mode = "walk" | "car";
export type StartKey = "nabawi" | "quba" | "uhud" | "custom";

export type Constraints = {
  minutes: number;
  companions: Companions;
  mobility: Mobility;
  interests: Interest[];
  start: StartKey;
  /** Coordinates for start = "custom" (visitor location or hotel). */
  startPoint?: LatLng | null;
  startLabel?: string | null;
  /** Preferred mode; null lets the solver decide. */
  mode?: Mode | null;
};

export type PlannerPlace = {
  slug: string;
  name: string;
  category: "mosque" | "well" | "garden" | "historical_site" | "other";
  lat: number;
  lng: number;
  featured: boolean;
  visitMinutes: number | null;
  hasStairs: boolean | null;
  walkingEffort: "low" | "medium" | "high" | null;
  /** One verified, cited fact to show at the stop (null if none approved yet). */
  fact: { text: string; vol: number | null; page: number | null } | null;
};

export type PlanWarning =
  | { kind: "stairs"; slug: string; alternative: string | null }
  | { kind: "effort"; slug: string }
  /** Nothing known about stairs or walking effort. */
  | { kind: "access_unknown"; slug: string }
  /** Walking effort known, stairs not. */
  | { kind: "stairs_unknown"; slug: string }
  | { kind: "long_walk"; minutes: number };

export type PlanLeg = { km: number; minutes: number; mode: Mode; fareSar: [number, number] | null };
export type PlanStop = { place: PlannerPlace; arriveAt: number; visitMinutes: number; leg: PlanLeg };
export type Plan = {
  stops: PlanStop[];
  /** Back to the start point — counted in the time budget. */
  returnLeg: PlanLeg | null;
  mode: Mode;
  totalMinutes: number;
  travelMinutes: number;
  warnings: PlanWarning[];
  /** Places left out ONLY because the time ran out — "if you have more time". */
  skipped: string[];
  start: { key: StartKey; point: LatLng; label: string | null };
};

export const START_POINTS: Record<Exclude<StartKey, "custom">, LatLng> = {
  nabawi: PROPHETS_MOSQUE,
  quba: { lat: 24.4394, lng: 39.6172 },
  uhud: { lat: 24.5022, lng: 39.6122 },
};

/** Sites tied to a battle (Uhud, the Trench) for the "battles" interest. */
const BATTLE_SLUGS = new Set(["jabal-al-rumah", "al-masajid-al-sabaa"]);

const DEFAULT_VISIT: Record<PlannerPlace["category"], number> = {
  mosque: 20,
  well: 15,
  garden: 20,
  historical_site: 30,
  other: 20,
};

export function interestsOf(p: PlannerPlace): Interest[] {
  const out: Interest[] = [];
  if (p.category === "mosque") out.push("mosques");
  if (p.category === "well" || p.category === "garden") out.push("wells_gardens");
  if (BATTLE_SLUGS.has(p.slug)) out.push("battles");
  return out;
}

export function visitMinutesOf(p: PlannerPlace): number {
  return p.visitMinutes ?? DEFAULT_VISIT[p.category];
}

/**
 * Approximate taxi / ride-hailing fare for a leg, in SAR. A clearly labelled
 * band, not a quote: short city rides in Madinah start around 10 SAR.
 */
export function fareBand(km: number): [number, number] {
  if (km < 3) return [10, 15];
  if (km < 8) return [15, 30];
  return [30, 50];
}

/** Longest single walking leg we suggest, by mobility (minutes). */
export const MAX_WALK_LEG: Record<Mobility, number> = { good: 25, limited: 8 };

/**
 * Pace by companions: how many stops make a pleasant visit, and how much rest
 * to add per stop. A plan for someone's elderly mother is not a sprint.
 */
const PACE: Record<Companions, { maxStops: number; restMinutes: number }> = {
  alone: { maxStops: 4, restMinutes: 0 },
  family: { maxStops: 4, restMinutes: 5 },
  kids: { maxStops: 4, restMinutes: 5 },
  elderly: { maxStops: 3, restMinutes: 10 },
};

/** Below this distance a car leg is just a short walk (no taxi for 200 m). */
const SHORT_WALK_KM: Record<Mobility, number> = { good: 0.8, limited: 0.3 };

function legBetween(a: LatLng, b: LatLng, mode: Mode, mobility: Mobility = "good"): PlanLeg {
  const km = haversineKm(a, b);
  if (km < 0.05) return { km: 0, minutes: 0, mode: "walk", fareSar: null }; // already there
  if (mode === "walk" || km < SHORT_WALK_KM[mobility]) {
    return { km, minutes: walkMinutes(km), mode: "walk", fareSar: null };
  }
  return { km, minutes: driveMinutes(km), mode, fareSar: fareBand(km) };
}

const walkTooLong = (leg: PlanLeg, mobility: Mobility) => leg.mode === "walk" && leg.minutes > MAX_WALK_LEG[mobility];

/**
 * Exact best visiting order for a handful of stops (n ≤ 4 → ≤ 24 orders),
 * door to door: the cost includes the way back to the start. Orders with a
 * walking leg over the visitor's limit are never considered, so a set is only
 * rejected when NO order respects the limit (null).
 */
function bestOrder(start: LatLng, places: PlannerPlace[], mode: Mode, mobility: Mobility): PlannerPlace[] | null {
  let best: PlannerPlace[] | null = null;
  let bestCost = Infinity;
  const permute = (rest: PlannerPlace[], acc: PlannerPlace[], from: LatLng, cost: number) => {
    if (cost >= bestCost) return;
    if (rest.length === 0) {
      const back = legBetween(from, start, mode, mobility);
      if (acc.length > 0 && walkTooLong(back, mobility)) return;
      if (cost + back.minutes < bestCost) {
        bestCost = cost + back.minutes;
        best = acc;
      }
      return;
    }
    rest.forEach((p, i) => {
      const leg = legBetween(from, p, mode, mobility);
      if (walkTooLong(leg, mobility)) return;
      permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, p], p, cost + leg.minutes);
    });
  };
  permute(places, [], start, 0);
  return best;
}

/** Travel (incl. the way back) and total door-to-door minutes for an order. */
function routeMinutes(start: LatLng, order: PlannerPlace[], mode: Mode, mobility: Mobility, rest: number) {
  let from = start;
  let travel = 0;
  let total = 0;
  for (const p of order) {
    const leg = legBetween(from, p, mode, mobility).minutes;
    travel += leg;
    total += leg + visitMinutesOf(p) + rest;
    from = p;
  }
  const back = order.length ? legBetween(from, start, mode, mobility).minutes : 0;
  return { travel: travel + back, total: total + back };
}

/**
 * Public entry: when the visitor didn't pick walk or car (and can walk), try
 * both and keep the plan that shows more, preferring walking on a tie.
 * Mobility is exactly what the visitor said: the form pre-selects "limited"
 * for older companions, but the visitor's own answer wins.
 */
export function solvePlan(all: PlannerPlace[], c: Constraints): Plan {
  if (c.mode || c.mobility === "limited") return solveWith(all, c, c.mode ?? "car");
  const walk = solveWith(all, c, "walk");
  const car = solveWith(all, c, "car");
  return car.stops.length > walk.stops.length ? car : walk;
}

function solveWith(all: PlannerPlace[], c: Constraints, mode: Mode): Plan {
  const startPoint =
    c.start === "custom" && c.startPoint ? c.startPoint : START_POINTS[c.start === "custom" ? "nabawi" : c.start];
  const mobility = c.mobility;
  const limited = mobility === "limited";
  const pace = PACE[c.companions];

  // Candidates: anything matching an interest (or everything if none given).
  const wanted = new Set(c.interests);
  const candidates = all.filter((p) => wanted.size === 0 || interestsOf(p).some((i) => wanted.has(i)));

  // Score: interest match, featured, having approved sourced content, and
  // closeness to the start (a short trip should stay local).
  const score = (p: PlannerPlace) => {
    const km = haversineKm(startPoint, p);
    const match = interestsOf(p).filter((i) => wanted.has(i)).length;
    const access = limited && (p.hasStairs === true || p.walkingEffort === "high") ? -3 : 0;
    return match * 3 + (p.featured ? 1 : 0) + (p.fact ? 1 : 0) + access - km * 0.6;
  };
  const ranked = [...candidates].sort((a, b) => score(b) - score(a));

  // Greedy fill by score with the best door-to-door order. Only places that
  // didn't fit the TIME are offered as "if you have more time"; the pace cap
  // and walking limits are about comfort, not time.
  let chosen: PlannerPlace[] = [];
  const skippedForTime: string[] = [];
  for (const p of ranked) {
    if (chosen.length >= pace.maxStops) break;
    const trial = bestOrder(startPoint, [...chosen, p], mode, mobility);
    if (!trial) continue;
    if (routeMinutes(startPoint, trial, mode, mobility, pace.restMinutes).total <= c.minutes) chosen = trial;
    else skippedForTime.push(p.slug);
  }

  // Stops with legs and arrival times, then the way back.
  const stops: PlanStop[] = [];
  let from = startPoint;
  let clock = 0;
  for (const p of chosen) {
    const leg = legBetween(from, p, mode, mobility);
    clock += leg.minutes;
    const visit = visitMinutesOf(p) + pace.restMinutes;
    stops.push({ place: p, arriveAt: clock, visitMinutes: visit, leg });
    clock += visit;
    from = p;
  }
  const returnLeg = chosen.length ? legBetween(from, startPoint, mode, mobility) : null;
  clock += returnLeg?.minutes ?? 0;
  const { travel } = routeMinutes(startPoint, chosen, mode, mobility, pace.restMinutes);

  // Warnings. A stairs alternative must be step-free, not strenuous, within
  // reach (the walking limit, or a short drive), share an interest, and still
  // fit the time if swapped in — otherwise we say so plainly instead.
  const warnings: PlanWarning[] = [];
  const used = new Set(chosen.map((p) => p.slug));
  for (const s of stops) {
    const p = s.place;
    if (limited && p.hasStairs === true) {
      const others = chosen.filter((q) => q.slug !== p.slug);
      const alt = all
        .filter(
          (q) =>
            !used.has(q.slug) &&
            q.hasStairs === false &&
            q.walkingEffort !== "high" &&
            interestsOf(q).some((i) => interestsOf(p).includes(i))
        )
        .filter((q) => {
          const leg = legBetween(p, q, mode, mobility);
          const reachable = leg.mode === "walk" ? leg.minutes <= MAX_WALK_LEG[mobility] : leg.km <= 3;
          if (!reachable) return false;
          const order = bestOrder(startPoint, [...others, q], mode, mobility);
          return !!order && routeMinutes(startPoint, order, mode, mobility, pace.restMinutes).total <= c.minutes;
        })
        .sort((a, b) => haversineKm(p, a) - haversineKm(p, b))[0];
      warnings.push({ kind: "stairs", slug: p.slug, alternative: alt?.slug ?? null });
    } else if (limited && p.walkingEffort === "high") {
      warnings.push({ kind: "effort", slug: p.slug });
    } else if (limited && p.hasStairs === null && p.walkingEffort === null) {
      warnings.push({ kind: "access_unknown", slug: p.slug });
    } else if (limited && p.hasStairs === null) {
      warnings.push({ kind: "stairs_unknown", slug: p.slug });
    }
  }
  const walkLegs = [...stops.map((s) => s.leg), ...(returnLeg ? [returnLeg] : [])].filter((l) => l.mode === "walk");
  const longest = Math.max(0, ...walkLegs.map((l) => l.minutes));
  if (longest > 15) warnings.push({ kind: "long_walk", minutes: longest });

  return {
    stops,
    returnLeg,
    mode,
    totalMinutes: clock,
    travelMinutes: travel,
    warnings,
    skipped: skippedForTime.filter((s) => !used.has(s)).slice(0, 3),
    start: { key: c.start, point: startPoint, label: c.startLabel ?? null },
  };
}
