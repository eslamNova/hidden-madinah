import QRCode from "qrcode";
import { getTranslations } from "next-intl/server";
import { siteUrl } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/admin/PrintButton";

/**
 * Printable QR sheet: one card per published place, pointing to
 * /places/<slug>?via=qr (which records the visit in "My journey").
 */
export default async function QrSheetPage() {
  const t = await getTranslations("admin.qr");
  const supabase = await createClient();
  const { data: places } = await supabase
    .from("places")
    .select("slug, name_ar, name_en")
    .eq("is_published", true)
    .order("name_ar");

  const origin = siteUrl();
  const cards = await Promise.all(
    (places ?? []).map(async (p) => {
      const url = `${origin}/places/${p.slug}?via=qr`;
      const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
      return { ...p, url, svg };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl">{t("title")}</h2>
          <p className="text-muted">{t("intro")}</p>
        </div>
        <PrintButton label={t("print")} />
      </div>
      <ul className="grid grid-cols-2 gap-4 print:gap-2">
        {cards.map((c) => (
          <li key={c.slug} className="break-inside-avoid space-y-2 rounded-2xl border-2 border-ink/20 bg-white p-4 text-center text-black">
            <p className="text-lg font-bold">{c.name_ar}</p>
            {c.name_en && <p className="text-sm">{c.name_en}</p>}
            <div className="mx-auto w-40" dangerouslySetInnerHTML={{ __html: c.svg }} />
            <p className="text-sm font-medium">{t("scanAr")}</p>
            <p className="text-xs">{t("scanEn")}</p>
            <p className="text-[10px] text-gray-600" dir="ltr">mazarat-madinah.com</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
