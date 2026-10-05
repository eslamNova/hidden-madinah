"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useTranslations } from "next-intl";
import { PrintButton } from "@/components/admin/PrintButton";

export function HotelCard({ origin }: { origin: string }) {
  const t = useTranslations("admin.hotel");
  const tq = useTranslations("admin.qr");
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [svg, setSvg] = useState<string | null>(null);

  const la = Number(lat);
  const ln = Number(lng);
  const hasPoint = lat.trim() !== "" && lng.trim() !== "" && Number.isFinite(la) && Number.isFinite(ln);
  // Same box the planner accepts for ?from= — a swapped or mistyped pair is caught here, not on the printed card.
  const inMadinah = hasPoint && la >= 24.2 && la <= 24.8 && ln >= 39.3 && ln <= 39.9;
  const valid = name.trim().length > 1 && inMadinah;

  /** Accept a pasted "24.4672, 39.6111" (as copied from Google Maps) in either field. */
  const setCoord = (which: "lat" | "lng", value: string) => {
    const pair = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,،]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (pair) {
      setLat(pair[1]);
      setLng(pair[2]);
    } else if (which === "lat") setLat(value);
    else setLng(value);
  };
  const url = valid
    ? `${origin}/plan?${new URLSearchParams({ from: `${la.toFixed(5)},${ln.toFixed(5)}`, name: name.trim() })}`
    : null;

  useEffect(() => {
    if (!url) {
      setSvg(null);
      return;
    }
    let live = true;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then((s) => live && setSvg(s));
    return () => {
      live = false;
    };
  }, [url]);

  const input = "min-h-11 w-full rounded-xl border border-ink/15 bg-sand/40 px-3";
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3 print:hidden">
        <label className="space-y-1 text-sm font-medium sm:col-span-3">
          {t("name")}
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={input} />
        </label>
        <label className="space-y-1 text-sm font-medium">
          {t("lat")}
          <input value={lat} onChange={(e) => setCoord("lat", e.target.value)} inputMode="decimal" dir="ltr" placeholder="24.4672" className={input} />
        </label>
        <label className="space-y-1 text-sm font-medium">
          {t("lng")}
          <input value={lng} onChange={(e) => setCoord("lng", e.target.value)} inputMode="decimal" dir="ltr" placeholder="39.6111" className={input} />
        </label>
        <div className="flex items-end">{svg && <PrintButton label={tq("print")} />}</div>
        {hasPoint && !inMadinah && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-3">
            {t("outside")}
          </p>
        )}
      </div>

      {svg && (
        <div className="mx-auto max-w-sm space-y-3 rounded-3xl border-2 border-dashed border-gray-400 bg-white p-6 text-center text-black">
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-2xl font-bold leading-snug">{t("headline")}</p>
          <div className="mx-auto w-48" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="font-medium">{t("sub")}</p>
          <p className="text-sm">{t("subEn")}</p>
          <p className="text-xs text-gray-600" dir="ltr">
            mazarat-madinah.com
          </p>
        </div>
      )}
    </div>
  );
}
