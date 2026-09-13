import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { TELEGRAM_CHANNEL } from "@/lib/constants";

/**
 * The channel as a single icon in the free top corner. The full card still
 * sits at the foot of the places list, but most visitors never scroll that
 * far — this is the one that gets seen.
 *
 * Physical top-LEFT in RTL, mirroring the أ control's top-RIGHT; it only ever
 * sits over photography (page heroes, story panels), so it wears the same
 * dark glass as the other controls over imagery — no backdrop-blur. 48px, the
 * elderly-first tap-target floor.
 *
 * Positioning is the caller's job: fixed on the story landing, absolute inside
 * PageHero.
 */
export function TelegramIconLink({ className = "" }: { className?: string }) {
  const t = useTranslations("telegram");

  return (
    <a
      href={TELEGRAM_CHANNEL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("short")}
      title={t("short")}
      className={`press flex h-12 w-12 items-center justify-center rounded-full border border-paper/20 bg-basalt/60 text-paper shadow-lg ${className}`}
    >
      <Send aria-hidden="true" className="h-5 w-5" />
    </a>
  );
}
