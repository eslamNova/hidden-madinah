import { getTranslations } from "next-intl/server";
import { siteUrl } from "@/lib/constants";
import { HotelCard } from "@/components/admin/HotelCard";

/** Printable card for a hotel reception: QR → /plan starting at the hotel. */
export default async function HotelCardPage() {
  const t = await getTranslations("admin.hotel");
  return (
    <div className="space-y-6">
      <div className="space-y-2 print:hidden">
        <h2 className="text-xl">{t("title")}</h2>
        <p className="text-muted">{t("intro")}</p>
      </div>
      <HotelCard origin={siteUrl()} />
    </div>
  );
}
