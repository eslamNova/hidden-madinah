import { useTranslations } from "next-intl";
import { Car, Clock, DoorOpen, MapPin, Signpost, Wallet } from "lucide-react";
import type { PublicPlaceView } from "@/lib/content";

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 border-b border-basalt/10 py-4 last:border-b-0">
      <span aria-hidden="true" className="mt-1 shrink-0 text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-muted">{label}</h3>
        <div className="mt-1 text-lg leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/**
 * The practical-logistics card — the app's core differentiator. Takes the
 * sanitized view, never the raw row.
 */
export function VisitInfoCard({ place }: { place: PublicPlaceView }) {
  const t = useTranslations("place");
  const tCommon = useTranslations("common");

  // Every row guards itself; when all of them are empty, hide the whole card
  // instead of rendering a bordered box holding nothing but its heading.
  const hasContent =
    place.distanceKm != null ||
    place.driveTimeMin != null ||
    !!place.howToGet ||
    place.transportOptions.length > 0 ||
    !!place.transportNote ||
    !!place.bestTime ||
    !!place.openStatus;
  if (!hasContent) return null;

  return (
    <section
      aria-label={t("visitInfo")}
      className="card-elevated p-5 sm:p-6"
    >
      <h2 className="mb-2 text-2xl">{t("visitInfo")}</h2>

      {place.distanceKm != null && (
        <InfoRow icon={<MapPin className="h-6 w-6" />} label={t("distance")}>
          {tCommon("distanceKm", { km: place.distanceKm })}
        </InfoRow>
      )}

      {place.driveTimeMin != null && (
        <InfoRow icon={<Car className="h-6 w-6" />} label={t("driveTime")}>
          {t("driveTimeValue", { min: place.driveTimeMin })}
        </InfoRow>
      )}

      {place.howToGet && (
        <InfoRow icon={<Signpost className="h-6 w-6" />} label={t("howToGet")}>
          {place.howToGet}
        </InfoRow>
      )}

      {(place.transportOptions.length > 0 || place.transportNote) && (
        <InfoRow icon={<Wallet className="h-6 w-6" />} label={t("transport")}>
          {place.transportOptions.length > 0 && (
            <ul className="space-y-2">
              {place.transportOptions.map((option, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-medium">{option.mode_ar}</span>
                  {option.min_sar != null &&
                    option.max_sar != null &&
                    (option.min_sar > 0 || option.max_sar > 0 ? (
                      // Only the numeric range sits in the LTR isolate —
                      // wrapping the whole phrase dragged "ريال" to the
                      // reading-start side of the numbers.
                      <span className="font-semibold text-primary">
                        <span className="ltr-nums">
                          {option.min_sar}–{option.max_sar}
                        </span>{" "}
                        {tCommon("sarUnit")}
                      </span>
                    ) : (
                      <span className="font-semibold text-primary">{t("free")}</span>
                    ))}
                  {option.note_ar && (
                    <span className="w-full text-base text-muted">{option.note_ar}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {place.transportNote && (
            <p className="mt-2 text-base text-muted">{place.transportNote}</p>
          )}
        </InfoRow>
      )}

      {place.bestTime && (
        <InfoRow icon={<Clock className="h-6 w-6" />} label={t("bestTime")}>
          {place.bestTime}
        </InfoRow>
      )}

      {place.openStatus && (
        <InfoRow icon={<DoorOpen className="h-6 w-6" />} label={t("openStatus")}>
          {place.openStatus}
        </InfoRow>
      )}
    </section>
  );
}