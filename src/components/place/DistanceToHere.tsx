"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Car,
  CircleAlert,
  Footprints,
  LoaderCircle,
  LocateFixed,
  MapPinCheck,
  Plane,
  type LucideIcon,
} from "lucide-react";
import { driveMinutes, formatDistance, haversineKm, walkMinutes } from "@/lib/geo";
import { useLang } from "@/lib/use-lang";

/** Straight-line distance under which walking time is shown; above it, driving. */
const WALK_LIMIT_KM = 2;
/** Further than this and the visitor is evidently not in Madinah yet. */
const FAR_KM = 60;
/** Closer than this and the visitor is, for all purposes, at the place. */
const AT_PLACE_KM = 0.1;
/** A fix this vague (metres) is likely Wi-Fi/IP-based: say the figure is approximate. */
const VAGUE_ACCURACY_M = 500;

type Status = "idle" | "locating" | "ready" | "denied" | "unavailable" | "unsupported";

const bold = (chunks: ReactNode) => <strong className="font-semibold">{chunks}</strong>;

/**
 * "كم أبعد عن هذا المكان؟" — the nearby message of the plan: "You are 450 m
 * from Quba Mosque — about 7 min on foot".
 *
 * Asks for the position only when the visitor taps, never on its own. The
 * position is used on the device to compute one number and is then dropped:
 * nothing is sent, logged or stored (not even in state — only the distance).
 *
 * Opened from the QR code on site (?via=qr), the visitor is standing there, so
 * the card simply says "You are here" instead of asking.
 */
export function DistanceToHere({ name, lat, lng }: { name: string; lat: number; lng: number }) {
  const t = useTranslations("place.howFar");
  const lang = useLang();
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<{ km: number; approx: boolean } | null>(null);
  const [viaQr, setViaQr] = useState(false);

  // QrCheckin strips ?via=qr from the address bar in a passive effect. Layout
  // effects of the same commit all run before any passive effect, so the
  // parameter is still there when this reads it — whatever the tree order.
  // Only ever set to true: a re-run after the strip (Strict Mode) must not undo it.
  useLayoutEffect(() => {
    if (new URLSearchParams(window.location.search).get("via") === "qr") setViaQr(true);
  }, []);

  if (viaQr) {
    return (
      <section aria-label={t("title")} className="card-elevated flex items-start gap-3 p-4 sm:p-5">
        <MapPinCheck aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-brand" />
        <p className="text-lg leading-relaxed">{t.rich("here", { name, b: bold })}</p>
      </section>
    );
  }

  const busy = status === "locating";

  const locate = () => {
    if (busy) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const km = haversineKm({ lat: pos.coords.latitude, lng: pos.coords.longitude }, { lat, lng });
        setResult({ km, approx: pos.coords.accuracy > VAGUE_ACCURACY_M });
        setStatus("ready");
      },
      // 1 = PERMISSION_DENIED; 2 (unavailable) and 3 (timeout) read the same to a visitor.
      (err) => setStatus(err.code === 1 ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 }
    );
  };

  let message: { icon: ReactNode; text: ReactNode; note?: string } | null = null;
  if (status === "ready" && result) {
    const { km, approx } = result;
    const note = approx ? t("approx") : undefined;
    const icon = (Icon: LucideIcon) => <Icon aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-brand" />;
    if (km > FAR_KM) {
      message = {
        icon: icon(Plane),
        text: t.rich("far", { distance: formatDistance(Math.round(km), lang), name, b: bold }),
      };
    } else if (km < AT_PLACE_KM && !approx) {
      // A vague fix can't vouch for "you're here" — it falls through to metres + the note.
      message = { icon: icon(MapPinCheck), text: t.rich("atPlace", { name, b: bold }), note };
    } else if (km < WALK_LIMIT_KM) {
      message = {
        icon: icon(Footprints),
        text: t.rich("walk", { distance: formatDistance(km, lang), name, min: walkMinutes(km), b: bold }),
        note,
      };
    } else {
      message = {
        icon: icon(Car),
        text: t.rich("drive", { distance: formatDistance(km, lang), name, min: driveMinutes(km), b: bold }),
        note,
      };
    }
  } else if (status === "denied" || status === "unavailable" || status === "unsupported") {
    message = {
      icon: <CircleAlert aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-muted" />,
      text: t(status),
    };
  }

  const primary = status === "idle" || status === "locating";
  const buttonLabel =
    status === "idle" ? t("button") : busy ? t("locating") : status === "ready" ? t("again") : t("retry");

  return (
    <section aria-label={t("title")} className="card-elevated p-4 sm:p-5">
      {/* Always mounted so screen readers announce the answer when it lands. */}
      <div role="status" aria-live="polite">
        {message && (
          <div className="mb-4 space-y-1">
            <p className="flex items-start gap-3 text-lg leading-relaxed">
              {message.icon}
              <span className="min-w-0 flex-1">{message.text}</span>
            </p>
            {message.note && <p className="ps-9 text-base text-muted">{message.note}</p>}
          </div>
        )}
      </div>

      {/* One button element through every state, so keyboard focus stays put;
          aria-disabled (not disabled) while locating for the same reason.
          Nothing to retry when the browser has no geolocation at all. */}
      {status !== "unsupported" && (
        <button
          type="button"
          onClick={locate}
          aria-disabled={busy || undefined}
          className={`press flex w-full items-center justify-center gap-2 rounded-2xl px-6 text-lg font-semibold sm:w-auto ${
            primary
              ? "min-h-14 bg-primary text-paper"
              : // Themed border (not border-primary): stays visible on dark cards.
                "min-h-12 border-[1.5px] border-brand bg-transparent text-brand"
          } ${busy ? "cursor-progress opacity-80" : ""}`}
        >
          {busy ? (
            <LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin motion-reduce:animate-none" />
          ) : (
            <LocateFixed aria-hidden="true" className="h-6 w-6" />
          )}
          {buttonLabel}
        </button>
      )}

      {status === "idle" && <p className="mt-3 text-base text-muted">{t("privacy")}</p>}
    </section>
  );
}
