"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { WifiOff } from "lucide-react";

/** Friendly banner shown while the visitor is offline (cached content stays browsable). */
export function OfflineBanner() {
  const t = useTranslations("offline");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="banner-in flex items-center justify-center gap-2 bg-basalt px-4 py-2 text-center text-sm text-paper"
    >
      <WifiOff aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span>{t("banner")}</span>
    </div>
  );
}
