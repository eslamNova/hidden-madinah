import { useTranslations } from "next-intl";
import {
  Car,
  Clock,
  DoorOpen,
  MapPin,
  Signpost,
  Wallet,
} from "lucide-react";
import { parseTransportOptions, stripVerify } from "@/lib/content";
import type { PlaceRow } from "@/lib/queries";

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

/** The practical-logistics card — the app's core differentiator. */
export function VisitInfoCard({ place }: { place: PlaceRow }) {
  const t = useTranslations("place");
  const tCommon = useTranslations("common");

  const howToGet = stripVerify(place.how_to_get_there_ar);
  const transportOptions = parseTransportOptions(place.transport_options);
  const transportNote = stripVerify(place.transport_note_ar);
  const bestTime = stripVerify(place.best_time_ar);
  const openStatus = stripVerify(place.open_status_ar);
  const km =
    place.distance_from_prophets_mosque_km != null
      ? Number(place.distance_from_prophets_mosque_km)
      : null;

  return (
    <section
      aria-label={t("visitInfo")}
      className="rounded-2xl border border-basalt/10 bg-surface p-5 shadow-sm"
    >
      <h2 className="mb-2 text-2xl">{t("visitInfo")}</h2>

      {km != null && (
        <InfoRow icon={<MapPin className="h-6 w-6" />} label={t("distance")}>
          {tCommon("distanceKm", { km })}
        </InfoRow>
      )}

      {place.drive_time_from_haram_min != null && (
        <InfoRow icon={<Car className="h-6 w-6" />} label={t("driveTime")}>
          {t("driveTimeValue", { min: place.drive_time_from_haram_min })}
        </InfoRow>
      )}

      {howToGet && (
        <InfoRow icon={<Signpost className="h-6 w-6" />} label={t("howToGet")}>
          {howToGet}
        </InfoRow>
      )}

      {(transportOptions.length > 0 || transportNote) && (
        <InfoRow icon={<Wallet className="h-6 w-6" />} label={t("transport")}>
          {transportOptions.length > 0 && (
            <ul className="space-y-2">
              {transportOptions.map((option, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-medium">{option.mode_ar}</span>
                  {option.min_sar != null &&
                    option.max_sar != null &&
                    (option.min_sar > 0 || option.max_sar > 0 ? (
                      <span className="ltr-nums font-semibold text-primary">
                        {tCommon("sarRange", {
                          min: option.min_sar,
                          max: option.max_sar,
                        })}
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
          {transportNote && (
            <p className="mt-2 text-base text-muted">{transportNote}</p>
          )}
        </InfoRow>
      )}

      {bestTime && (
        <InfoRow icon={<Clock className="h-6 w-6" />} label={t("bestTime")}>
          {bestTime}
        </InfoRow>
      )}

      {openStatus && (
        <InfoRow icon={<DoorOpen className="h-6 w-6" />} label={t("openStatus")}>
          {openStatus}
        </InfoRow>
      )}
    </section>
  );
}