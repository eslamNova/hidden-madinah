"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { GA_MEASUREMENT_ID, type ConsentChoice } from "@/lib/constants";
import { CONSENT_EVENT, readConsent, writeConsent } from "@/lib/consent";
import { ConsentBanner } from "./ConsentBanner";
import { GoogleAnalytics } from "./GoogleAnalytics";

/**
 * Owns the consent decision for the whole site: shows the notice while it is
 * unanswered, mounts the GA4 tag once it is granted. Rendered from the root
 * layout.
 *
 * The initial state is `undefined` ("not read yet") rather than null, because
 * localStorage is only readable after mount — starting at null would flash the
 * notice at every returning visitor who already accepted.
 */
export function SiteAnalytics() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentChoice | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => setConsent(readConsent());
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    // Answering in another tab settles this one too.
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Don't ask on the chrome-less tour stream or inside the staff admin — the
  // tour has no room for it and admin traffic is ours. An existing consent
  // still applies on those routes; only the prompt is withheld.
  const canAsk = !pathname.startsWith("/admin") && !pathname.endsWith("/tour");

  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      {consent === "granted" && <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />}
      {consent === null && canAsk && (
        <ConsentBanner
          onAccept={() => writeConsent("granted")}
          onDecline={() => writeConsent("denied")}
        />
      )}
    </>
  );
}
