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
 * override); buttons use scrollIntoView so RTL/LTR scroll math never matters.
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
        <div className="mt-3 space-y-3">
          {/* Dots: one per slide (the counter takes over past 12). */}
          {media.length <= 12 && (
            <div aria-hidden="true" className="flex justify-center gap-1.5">
              {media.map((m, i) => (
                <span
                  key={m.id}
                  className={`h-2 w-2 rounded-full transition-[background-color,transform] duration-300 ease-out ${
                    i === current ? "scale-[1.4] bg-brand" : "bg-ink/25"
                  }`}
                />
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            {/* Labeled controls — a chevron alone was not expressive enough.
                The chevrons point the reading way: "next" points left in
                Arabic and flips to point right on English pages. */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => goTo(current + 1)}
                disabled={current === media.length - 1}
                aria-label={t("galleryNext")}
                className="press inline-flex min-h-12 items-center gap-1.5 rounded-2xl bg-primary px-4 text-base font-semibold text-paper shadow-sm disabled:opacity-40"
              >
                <ChevronLeft aria-hidden="true" className="h-5 w-5 ltr:-scale-x-100" />
                {t("galleryNext")}
              </button>
              <button
                type="button"
                onClick={() => goTo(current - 1)}
                disabled={current === 0}
                aria-label={t("galleryPrev")}
                className="press inline-flex min-h-12 items-center gap-1.5 rounded-2xl border-[1.5px] border-ink/15 bg-surface px-4 text-base font-semibold text-ink shadow-sm disabled:opacity-40"
              >
                {t("galleryPrev")}
                <ChevronRight aria-hidden="true" className="h-5 w-5 ltr:-scale-x-100" />
              </button>
            </div>
            <p aria-live="polite" className="text-base font-medium text-muted">
              {t("galleryImageOf", { current: current + 1, total: media.length })}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}