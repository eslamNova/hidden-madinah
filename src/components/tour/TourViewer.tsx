"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, Pause, Play, X } from "lucide-react";
import type { CoverImage } from "@/lib/content";
import { CATEGORY_META, type PlaceCategory } from "@/lib/maps";
import { CategoryIcon } from "@/components/CategoryIcon";
import { PlaceImage } from "@/components/place/PlaceImage";
import { VideoPlayer } from "@/components/place/VideoPlayer";

/** Lean, serializable slide — one media item with its place context. */
export type TourSlide = {
  id: string;
  kind: "photo" | "video";
  /** Photos: the 1600 variant URL (PlaceImage derives the set). Videos: mp4. */
  url: string;
  poster: CoverImage | null;
  width: number;
  height: number;
  caption: string | null;
  placeName: string;
  placeSlug: string;
  category: PlaceCategory;
  summary: string | null;
};

const PHOTO_DWELL_MS = 6000;
const VIDEO_DWELL_MS = 9000;

/**
 * Full-screen auto-playing photo tour. Slides fill the viewport edge-to-edge
 * (object-cover, reels-style); the show advances by itself — a thin progress
 * bar at the top shows each slide's dwell, and the pause/play button or any
 * manual scroll hands control back to the user. Videos never autoplay
 * (elderly-first): their poster dwells a little longer, and if the user taps
 * play the show waits for the clip to end before moving on.
 */
export function TourViewer({ slides }: { slides: TourSlide[] }) {
  const t = useTranslations("tour");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [videoActive, setVideoActive] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, index));
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      slideRefs.current[clamped]?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "start",
      });
    },
    [slides.length]
  );

  // Track the visible slide (auto-scroll and manual swipes both land here).
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = slideRefs.current.indexOf(entry.target as HTMLElement);
            if (idx >= 0) {
              setCurrent(idx);
              setVideoActive(false);
            }
          }
        }
      },
      { root: containerRef.current, threshold: 0.6 }
    );
    slideRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [slides.length]);

  // The slideshow clock: one dwell per slide, suspended while a video plays.
  useEffect(() => {
    if (!playing || videoActive) return;
    if (current >= slides.length - 1) {
      setPlaying(false);
      return;
    }
    const dwell = slides[current]?.kind === "video" ? VIDEO_DWELL_MS : PHOTO_DWELL_MS;
    const id = setTimeout(() => goTo(current + 1), dwell);
    return () => clearTimeout(id);
  }, [playing, videoActive, current, slides, goTo]);

  // Manual interaction hands control back to the user.
  const pause = () => setPlaying(false);

  if (slides.length === 0) {
    return (
      <div className="flex h-dvh items-center justify-center px-4">
        <p className="card-elevated p-8 text-center text-lg text-muted">{t("empty")}</p>
      </div>
    );
  }

  const dwell = slides[current]?.kind === "video" ? VIDEO_DWELL_MS : PHOTO_DWELL_MS;

  return (
    <div className="relative bg-basalt">
      <div
        ref={containerRef}
        tabIndex={0}
        role="region"
        aria-label={t("regionLabel")}
        onWheel={pause}
        onTouchMove={pause}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "PageDown" || e.key === "PageUp") {
            pause();
          }
        }}
        className="story-viewport scrollbar-hidden snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
      >
        {slides.map((s, i) => (
          <section
            key={s.id}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            aria-label={`${s.placeName} — ${t("slideOf", { current: i + 1, total: slides.length })}`}
            className="relative h-full w-full shrink-0 snap-start overflow-hidden bg-basalt"
          >
            {s.kind === "photo" ? (
              // Full-bleed, like the story landing: the photo IS the screen.
              <PlaceImage
                media={{ url: s.url, width: s.width, height: s.height }}
                alt={s.caption ?? s.placeName}
                sizes="100vw"
                capMobile
                priority={i === 0}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <>
                {/* Poster fills the frame; the tappable player sits over it. */}
                {s.poster && (
                  <PlaceImage
                    media={s.poster}
                    alt=""
                    sizes="100vw"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div aria-hidden="true" className="absolute inset-0 bg-basalt/40" />
                <div className="absolute inset-0 flex items-center justify-center px-2 pb-36">
                  <div className="w-full max-w-3xl">
                    <VideoPlayer
                      media={{ url: s.url, thumb_url: s.poster?.url ?? null }}
                      title={s.caption ?? s.placeName}
                      onPlay={() => setVideoActive(true)}
                      onEnded={() => {
                        setVideoActive(false);
                        if (playing) goTo(i + 1);
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Bottom scrim carries the full place context — the tour should
                teach, not tease. */}
            <div aria-hidden="true" className="scrim absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 px-5 pb-10 pt-10">
              <div className="mx-auto w-full max-w-3xl space-y-2">
                <span
                  className="flex items-center gap-2 text-sm font-medium"
                  style={{ color: CATEGORY_META[s.category].tintOnDark }}
                >
                  <CategoryIcon category={s.category} className="h-5 w-5 shrink-0" />
                  {CATEGORY_META[s.category].labelAr}
                </span>
                <h2 className="text-2xl leading-snug text-surface">{s.placeName}</h2>
                {s.summary && (
                  <p className="max-w-xl text-base leading-relaxed text-surface/90">
                    {s.summary}
                  </p>
                )}
                {s.caption && s.caption !== s.summary && (
                  <p className="max-w-xl text-sm leading-relaxed text-surface/70">
                    {s.caption}
                  </p>
                )}
                <Link
                  href={`/places/${encodeURIComponent(s.placeSlug)}`}
                  className="press mt-1 inline-flex min-h-12 items-center gap-1.5 rounded-2xl bg-surface/95 px-5 text-base font-semibold text-primary-dark shadow-lg"
                >
                  {t("openPlace")}
                  <ChevronLeft aria-hidden="true" className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* Dwell progress — restarts per slide, freezes on pause. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 bg-surface/20"
      >
        <div
          key={current}
          className="tour-progress h-full bg-accent"
          style={{
            animationDuration: `${dwell}ms`,
            animationPlayState: playing && !videoActive ? "running" : "paused",
          }}
        />
      </div>

      {/* Fixed chrome: exit, counter, pause/play. */}
      <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex items-center justify-between px-3 pt-[env(safe-area-inset-top)]">
        <Link
          href="/"
          aria-label={t("exit")}
          className="press pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-surface/15 bg-basalt/85 text-surface shadow-lg"
        >
          <X aria-hidden="true" className="h-6 w-6" />
        </Link>
        <div className="pointer-events-auto flex items-center gap-2">
          <span
            aria-hidden="true"
            className="ltr-nums rounded-full border border-surface/15 bg-basalt/85 px-4 py-1.5 text-sm font-medium text-surface shadow-lg"
          >
            {`${current + 1} / ${slides.length}`}
          </span>
          <button
            type="button"
            onClick={() => setPlaying((v) => !v)}
            aria-label={playing ? t("pauseTour") : t("playTour")}
            className="press flex h-12 w-12 items-center justify-center rounded-full border border-surface/15 bg-basalt/85 text-surface shadow-lg"
          >
            {playing ? (
              <Pause aria-hidden="true" className="h-5 w-5" fill="currentColor" />
            ) : (
              <Play aria-hidden="true" className="h-5 w-5" fill="currentColor" />
            )}
          </button>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {t("slideOf", { current: current + 1, total: slides.length })}
      </p>
    </div>
  );
}
