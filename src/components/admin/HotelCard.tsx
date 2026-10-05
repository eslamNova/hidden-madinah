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
  const valid = name.trim().length > 1 && Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180 && lat !== "" && lng !== "";
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
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={input} />
        </label>
        <label className="space-y-1 text-sm font-medium">
          {t("lat")}
          <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" dir="ltr" placeholder="24.4672" className={input} />
        </label>
        <label className="space-y-1 text-sm font-medium">
          {t("lng")}
          <input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" dir="ltr" placeholder="39.6111" className={input} />
        </label>
        <div className="flex items-end">{svg && <PrintButton label={tq("print")} />}</div>
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
