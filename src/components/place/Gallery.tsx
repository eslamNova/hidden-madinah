"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { stripVerify } from "@/lib/content";
import type { MediaRow } from "@/lib/queries";
import { PlaceImage } from "@/components/place/PlaceImage";
import { VideoPlayer } from "@/components/place/VideoPlayer";

/**
 * Swipeable scroll-snap gallery. Pinch-zoom stays available (no touch-action
 * override); buttons use scrollIntoView so RTL scroll math never matters.
 */
export function Gallery({ media, placeName }: { media: MediaRow[]; placeName: string }) {
  const t = useTranslations("place");
  const [current, setCurrent] = useState(0);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = slideRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx >= 0) setCurrent(idx);
          }
        }
      },
      { threshold: 0.6 }
    );
    slideRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [media.length]);

  if (media.length === 0) return null;

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(media.length - 1, index));
    // Explicit "smooth" bypasses the CSS reduced-motion override — check the
    // preference here so vestibular-sensitive users get an instant jump.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    slideRefs.current[clamped]?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  return (
    <section aria-label={t("gallery")} className="relative">
      <div className="scrollbar-hidden flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-2xl">
        {media.map((m, i) => {
          // Captions are owner-entered — [VERIFY] markers must not reach the page.
          const caption = stripVerify(m.caption_ar);
          return (
            <div
              key={m.id}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              className="w-full shrink-0 snap-center"
            >
              {m.type === "video" ? (
                <VideoPlayer media={m} title={caption ?? placeName} />
              ) : (
                <figure>
                  {/* No priority: the gallery is below the fold — an eager
                      high-priority fetch here contends with the hero LCP. */}
                  <PlaceImage
                    media={m}
                    alt={caption ?? placeName}
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="aspect-[4/3] w-full rounded-2xl object-cover"
                  />
                  {caption && (
                    <figcaption className="mt-2 px-1 text-base text-muted">
                      {caption}
                    </figcaption>
                  )}
                </figure>
              )}
            </div>
          );
        })}
      </div>

      {media.length > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-2">
            {/* In RTL, "next" is visually to the left. */}
            {/* Static action labels — the aria-live counter below announces
                position; computed labels produced "صورة 0 من N" at the ends. */}
            <button
              type="button"
              onClick={() => goTo(current + 1)}
              disabled={current === media.length - 1}
              aria-label={t("galleryNext")}
              className="press flex h-12 w-12 items-center justify-center rounded-xl border-[1.5px] border-basalt/30 bg-surface disabled:opacity-40"
            >
              <ChevronLeft aria-hidden="true" className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              aria-label={t("galleryPrev")}
              className="press flex h-12 w-12 items-center justify-center rounded-xl border-[1.5px] border-basalt/30 bg-surface disabled:opacity-40"
            >
              <ChevronRight aria-hidden="true" className="h-6 w-6" />
            </button>
          </div>
          <p aria-live="polite" className="text-base text-muted">
            {t("galleryImageOf", { current: current + 1, total: media.length })}
          </p>
        </div>
      )}
    </section>
  );
}