"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, X } from "lucide-react";
import { addVisit } from "@/lib/visits";

/**
 * QR codes at each site point to /places/<slug>?via=qr. Landing that way
 * records the visit on the device ("My journey") and says so; the parameter
 * is then removed so a shared link or a refresh doesn't re-trigger it.
 * Read from window.location (not useSearchParams) so the page stays static.
 */
export function QrCheckin({ slug, name }: { slug: string; name: string }) {
  const t = useTranslations("journey");
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("via") !== "qr") return;
    addVisit(slug, "qr");
    setShown(true);
    url.searchParams.delete("via");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [slug]);

  if (!shown) return null;
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl bg-primary p-4 text-paper shadow-md">
      <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
      <p className="flex-1 leading-relaxed">
        {t("qrWelcome", { name })}{" "}
        <Link href="/my-journey" className="font-semibold underline">
          {t("myJourney")}
        </Link>
      </p>
      <button type="button" onClick={() => setShown(false)} aria-label={t("close")} className="flex h-11 w-11 items-center justify-center">
        <X aria-hidden="true" className="h-5 w-5" />
      </button>
    </div>
  );
}
