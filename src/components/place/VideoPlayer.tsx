"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Play } from "lucide-react";
import type { MediaRow } from "@/lib/queries";

/**
 * Native video player: poster, preload="none", playsInline, oversized play
 * button, never autoplay (elderly-first media rules).
 */
export function VideoPlayer({
  media,
  title,
  onPlay,
  onEnded,
}: {
  media: Pick<MediaRow, "url" | "thumb_url">;
  title: string;
  /** Optional hooks for hosts that react to playback (the tour's auto-advance). */
  onPlay?: () => void;
  onEnded?: () => void;
}) {
  const t = useTranslations("place");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-basalt">
      <video
        ref={videoRef}
        src={media.url}
        poster={media.thumb_url ?? undefined}
        preload="none"
        playsInline
        controls={started}
        onPlay={onPlay}
        onEnded={onEnded}
        className="aspect-video w-full"
      />
      {!started && (
        <button
          type="button"
          onClick={() => {
            setStarted(true);
            void videoRef.current?.play();
          }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-basalt/30"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/90 shadow-lg">
            <Play aria-hidden="true" className="h-9 w-9 text-paper" fill="currentColor" />
          </span>
          <span className="rounded-full bg-basalt/70 px-4 py-1 text-base font-medium text-paper">
            {t("videoPlay")}: {title}
          </span>
        </button>
      )}
    </div>
  );
}