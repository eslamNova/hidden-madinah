"use client";

import { VISITS_STORAGE_KEY } from "@/lib/constants";

/**
 * "My journey": the places a visitor checked in at (QR scan or a tap), and
 * journey progress. Stored ONLY on the device — no account, nothing sent to
 * a server — and every write broadcasts VISITS_EVENT so open views update.
 * Same pattern as consent.ts.
 */
export const VISITS_EVENT = "hm-visits-change";

export type Visit = { slug: string; at: number; via: "qr" | "tap" | "journey" };
export type JourneyProgress = {
  stop: number;               // furthest stop reached (1-based)
  completed: boolean;
  pre?: number[];             // pre-quiz answers
  post?: number[];            // post-quiz answers
  familiarity?: "new" | "some" | "good";
  submitted?: boolean;        // anonymous result already sent
};
type Store = { visits: Visit[]; journeys: Record<string, JourneyProgress> };

const EMPTY: Store = { visits: [], journeys: {} };

function read(): Store {
  try {
    const raw = localStorage.getItem(VISITS_STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { visits: Array.isArray(parsed.visits) ? parsed.visits : [], journeys: parsed.journeys ?? {} };
  } catch {
    return EMPTY;
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(VISITS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage blocked: the session still works, it just won't persist.
  }
  window.dispatchEvent(new Event(VISITS_EVENT));
}

export function readVisits(): Visit[] {
  return read().visits;
}

/** Records a check-in once per place (the first one wins). Returns true if new. */
export function addVisit(slug: string, via: Visit["via"]): boolean {
  const store = read();
  if (store.visits.some((v) => v.slug === slug)) return false;
  write({ ...store, visits: [...store.visits, { slug, at: Date.now(), via }] });
  return true;
}

export function readJourneyProgress(slug: string): JourneyProgress | null {
  return read().journeys[slug] ?? null;
}

export function readAllJourneyProgress(): Record<string, JourneyProgress> {
  return read().journeys;
}

export function saveJourneyProgress(slug: string, patch: Partial<JourneyProgress>) {
  const store = read();
  const prev = store.journeys[slug] ?? { stop: 0, completed: false };
  write({ ...store, journeys: { ...store.journeys, [slug]: { ...prev, ...patch } } });
}

export function resetJourneyProgress(slug: string) {
  const store = read();
  const journeys = { ...store.journeys };
  delete journeys[slug];
  write({ ...store, journeys });
}
