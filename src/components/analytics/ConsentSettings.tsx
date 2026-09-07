"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { GA_MEASUREMENT_ID, type ConsentChoice } from "@/lib/constants";
import { CONSENT_EVENT, readConsent, writeConsent } from "@/lib/consent";

/**
 * Withdrawing consent has to be as easy as giving it, so the privacy page
 * carries the live choice and a single button that flips it — no menu, no
 * second confirmation. Unanswered reads as "off", which is what it is.
 */
export function ConsentSettings() {
  const t = useTranslations("privacy");
  const [consent, setConsent] = useState<ConsentChoice | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => setConsent(readConsent());
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!GA_MEASUREMENT_ID) return null;
  // Nothing until localStorage has been read — a wrong status for one frame is
  // worse here than a late one.
  if (consent === undefined) return null;

  const granted = consent === "granted";

  return (
    <div className="card-elevated p-5">
      <p className="flex items-center gap-2 text-lg font-semibold">
        {granted ? (
          <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-brand" />
        ) : (
          <X aria-hidden="true" className="h-5 w-5 shrink-0 text-muted" />
        )}
        {granted ? t("statusOn") : t("statusOff")}
      </p>
      <p className="mt-1 text-muted">{granted ? t("statusOnHint") : t("statusOffHint")}</p>
      <button
        type="button"
        onClick={() => writeConsent(granted ? "denied" : "granted")}
        className={`press mt-4 min-h-14 w-full rounded-2xl px-6 text-lg font-semibold sm:w-auto ${
          granted ? "bg-ink/10 text-ink" : "bg-primary text-paper"
        }`}
      >
        {granted ? t("turnOff") : t("turnOn")}
      </button>
    </div>
  );
}
