"use client";

import { CONSENT_STORAGE_KEY, type ConsentChoice } from "@/lib/constants";

/**
 * Analytics consent. GA4 writes a first-party cookie and so needs an explicit
 * choice under Saudi PDPL (and GDPR for visitors abroad); Vercel Analytics is
 * cookieless and is deliberately NOT gated on any of this.
 *
 * The choice lives in localStorage and every write broadcasts CONSENT_EVENT,
 * so the notice, the tag and the privacy-page control stay in sync without a
 * context provider wrapping the whole tree for a once-per-visitor decision.
 */
export const CONSENT_EVENT = "hm-consent-change";

/** Returns null when the visitor has not answered yet. */
export function readConsent(): ConsentChoice | null {
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    return stored === "granted" || stored === "denied" ? stored : null;
  } catch {
    // Private mode / storage blocked: treat as unanswered, never throw. The
    // notice reappears next visit, which is the correct failure direction.
    return null;
  }
}

export function writeConsent(choice: ConsentChoice) {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Nothing persisted, but the in-memory choice below still applies for
    // this session — the visitor's tap is honoured either way.
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** Back to unanswered, which brings the notice back. */
export function clearConsent() {
  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // See writeConsent.
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
