"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, Eye, EyeOff, Loader2, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import type { CoverImage } from "@/lib/content";
import { CATEGORY_META, type PlaceCategory } from "@/lib/maps";
import { CategoryIcon } from "@/components/CategoryIcon";
import { PlaceImage } from "@/components/place/PlaceImage";

/** Lean, serializable slide — one media item with its place context. */
export type TourSlide = {
  id: string;
  kind: "photo" | "video";
  /** Photos: the 1600 variant URL (PlaceImage derives the set). Videos: mp4. */
  url: string;
  poster: CoverImage | null;
  width: number;
  height: number;
  durationSeconds: number | null;
  caption: string | null;
  placeName: string;
  /** null for chapters that are not a place (المسجد النبوي). */
  placeSlug: string | null;
  category: PlaceCategory;
  summary: string | null;
};

const PHOTO_DWELL_MS = 6000;
/** Used only when a video cannot autoplay (browser block) — the poster dwells. */
const VIDEO_FALLBACK_DWELL_MS = 9000;

/**
 * Full-bleed video slide. Plays by itself when it becomes the current slide
 * (muted — browsers only allow silent autoplay; a speaker button unmutes),
 * rewinds when it leaves, and tells the tour when it ends so the show moves
 * on. If autoplay is blocked, a big play button takes over.
 */
function TourVideo({
  slide,
  active,
  playing,
  muted,
  near,
  onStarted,
  onEnded,
  onBlocked,
  onReady,
}: {
  slide: TourSlide;
  active: boolean;
  playing: boolean;
  muted: boolean;
  near: boolean;
  onStarted: () => void;
  onEnded: () => void;
  onBlocked: () => void;
  onReady: () => void;
}) {
  const t = useTranslations("tour");
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active && playing) {
      el.play()
        .then(() => setBlocked(false))
        .catch(() => {
          setBlocked(true);
          onBlocked();
        });
    } else {
      el.pause();
      if (!active) el.currentTime = 0;
    }
  }, [active, playing, onBlocked]);

  return (
    <>
      <video
        ref={ref}
        src={slide.url}
        poster={slide.poster?.url}
        muted={muted}
        playsInline
        preload={near ? "auto" : "none"}
        onPlaying={() => {
          setBlocked(false);
          onStarted();
        }}
        onEnded={onEnded}
        onLoadedData={onReady}
        onError={onReady}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {blocked && active && (
        <button
          type="button"
          onClick={() => void ref.current?.play()}
          aria-label={t("tapToPlay")}
          className="press absolute inset-0 z-[5] flex items-center justify-center"
        >
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/90 text-paper shadow-lg">
            <Play aria-hidden="true" className="h-10 w-10" fill="currentColor" />
          </span>
        </button>
      )}
    </>
  );
}

/**
 * Full-screen auto-playing photo tour. Slides fill the viewport edge-to-edge
 * (object-cover, reels-style); the show advances by itself — photos dwell
 * 6 s, videos play through — with a thin progress bar on top, and the
 * pause/play button or any manual scroll hands control back to the user.
 * The clock never advances past a frame that has not loaded yet (spinner
 * on slow links; neighbouring frames pre-fetch).
 */
export function TourViewer({
  slides,
  exitHref = "/",
}: {
  slides: TourSlide[];
  /** Where the exit button returns to ("/" for the site tour, the place page for a place tour). */
  exitHref?: string;
}) {
  const t = useTranslations("tour");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  // Clean view: media only — no text, scrim, progress or controls. Tapping the
  // media (or the eye button / Escape) toggles it.
  const [uiHidden, setUiHidden] = useState(false);
  // A video is actually playing → the dwell clock is suspended until it ends.
  const [videoActive, setVideoActive] = useState(false);
  // Autoplay was blocked on the current video → fall back to a poster dwell.
  const [videoBlocked, setVideoBlocked] = useState(false);
  // Slides whose media bytes are on screen.
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const markLoaded = useCallback((id: string) => {
    setLoaded((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

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
              setVideoBlocked(false);
            }
          }
        }
      },
      { root: containerRef.current, threshold: 0.6 }
    );
    slideRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [slides.length]);

  const currentSlide = slides[current];
  const currentReady = !currentSlide || loaded.has(currentSlide.id);

  // The photo clock. Videos advance themselves on `ended` (or, if autoplay
  // was blocked, after a poster dwell).
  useEffect(() => {
    if (!playing || !currentReady || videoActive) return;
    if (current >= slides.length - 1) {
      setPlaying(false);
      return;
    }
    if (currentSlide?.kind === "video" && !videoBlocked) return;
    const dwell = currentSlide?.kind === "video" ? VIDEO_FALLBACK_DWELL_MS : PHOTO_DWELL_MS;
    const id = setTimeout(() => goTo(current + 1), dwell);
    return () => clearTimeout(id);
  }, [playing, currentReady, videoActive, videoBlocked, current, currentSlide, slides.length, goTo]);

  const pause = () => setPlaying(false);
  const toggleUi = () => setUiHidden((v) => !v);

  useEffect(() => {
    if (!uiHidden) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUiHidden(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [uiHidden]);
  const onVideoBlocked = useCallback(() => setVideoBlocked(true), []);

  if (slides.length === 0) {
    return (
      <div className="flex h-dvh items-center justify-center px-4">
        <p className="card-elevated p-8 text-center text-lg text-muted">{t("empty")}</p>
      </div>
    );
  }

  // Progress bar: a video's own length while it plays, the dwell otherwise.
  const barMs =
    currentSlide?.kind === "video" && videoActive && currentSlide.durationSeconds
      ? currentSlide.durationSeconds * 1000
      : currentSlide?.kind === "video"
        ? VIDEO_FALLBACK_DWELL_MS
        : PHOTO_DWELL_MS;
  const barRunning =
    playing && currentReady && (currentSlide?.kind !== "video" || videoActive || videoBlocked);

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
          if (["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(e.key)) pause();
        }}
        // A tap on the media itself toggles the clean view; taps on buttons and
        // links inside the slide keep their own meaning.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a, button")) return;
          toggleUi();
        }}
        className="story-viewport scrollbar-hidden snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
      >
        {slides.map((s, i) => {
          const near = Math.abs(i - current) <= 1;
          return (
            <section
              key={s.id}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              aria-label={`${s.placeName} — ${t("slideOf", { current: i + 1, total: slides.length })}`}
              className="relative h-full w-full shrink-0 snap-start overflow-hidden bg-basalt"
            >
              {s.kind === "photo" ? (
                <PlaceImage
                  media={{ url: s.url, width: s.width, height: s.height }}
                  alt={s.caption ?? s.placeName}
                  sizes="100vw"
                  capMobile
                  priority={near}
                  onLoaded={() => markLoaded(s.id)}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <TourVideo
                  slide={s}
                  active={i === current}
                  playing={playing}
                  muted={muted}
                  near={near}
                  onStarted={() => setVideoActive(true)}
                  onEnded={() => {
                    setVideoActive(false);
                    if (playing) goTo(i + 1);
                  }}
                  onBlocked={onVideoBlocked}
                  onReady={() => markLoaded(s.id)}
                />
              )}

              {/* Bottom scrim carries the full place context — tap-transparent
                  so the video underneath stays interactive. */}
              <div
                aria-hidden="true"
                className={`scrim pointer-events-none absolute inset-0 transition-opacity duration-300 ${uiHidden ? "opacity-0" : "opacity-100"}`}
              />
              <div
                className={`pointer-events-none absolute inset-x-0 bottom-0 px-5 pb-10 pt-10 transition-opacity duration-300 ${uiHidden ? "opacity-0" : "opacity-100"}`}
                {...(uiHidden && { inert: true })}
              >
                <div className="mx-auto w-full max-w-3xl space-y-2">
                  <span
                    className="flex items-center gap-2 text-sm font-medium"
                    style={{ color: CATEGORY_META[s.category].tintOnDark }}
                  >
                    <CategoryIcon category={s.category} className="h-5 w-5 shrink-0" />
                    {CATEGORY_META[s.category].labelAr}
                  </span>
                  <h2 className="text-2xl leading-snug text-paper">{s.placeName}</h2>
                  {s.summary && (
                    <p className="max-w-xl text-base leading-relaxed text-paper/90">{s.summary}</p>
                  )}
                  {s.caption && s.caption !== s.summary && (
                    <p className="max-w-xl text-sm leading-relaxed text-paper/70">{s.caption}</p>
                  )}
                  {s.placeSlug && (
                    <Link
                      href={`/places/${encodeURIComponent(s.placeSlug)}`}
                      className="press pointer-events-auto mt-1 inline-flex min-h-12 items-center gap-1.5 rounded-2xl bg-paper/95 px-5 text-base font-semibold text-primary-dark shadow-lg"
                    >
                      {t("openPlace")}
                      <ChevronLeft aria-hidden="true" className="h-5 w-5" />
                    </Link>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Loader while the current frame is still downloading (slow links). */}
      {!currentReady && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-basalt/70 text-paper shadow-lg">
            <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin" />
          </span>
          <span className="sr-only">{t("loading")}</span>
        </div>
      )}

      {/* Progress — restarts per slide, tracks a playing video's length. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-1 bg-paper/20 transition-opacity duration-300 ${uiHidden ? "opacity-0" : "opacity-100"}`}
      >
        <div
          key={`${current}-${videoActive}`}
          className="tour-progress h-full bg-accent"
          style={{
            animationDuration: `${barMs}ms`,
            animationPlayState: barRunning ? "running" : "paused",
          }}
        />
      </div>

      {/* Fixed chrome: big labeled exit, counter, sound (videos), clean view,
          pause/play. Fades out in clean view; a tap on the media brings it back. */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-2 z-10 flex items-center justify-between px-3 pt-[env(safe-area-inset-top)] transition-opacity duration-300 ${uiHidden ? "opacity-0" : "opacity-100"}`}
        {...(uiHidden && { inert: true })}
      >
        <Link
          href={exitHref}
          aria-label={t("exit")}
          className="press pointer-events-auto flex min-h-14 items-center gap-2 rounded-full border border-paper/25 bg-paper px-5 text-lg font-semibold text-basalt shadow-lg"
        >
          <X aria-hidden="true" className="h-6 w-6" />
          {t("exitShort")}
        </Link>
        <div className="pointer-events-auto flex items-center gap-2">
          <span
            aria-hidden="true"
            className="ltr-nums rounded-full border border-paper/15 bg-basalt/85 px-4 py-1.5 text-sm font-medium text-paper shadow-lg"
          >
            {`${current + 1} / ${slides.length}`}
          </span>
          {currentSlide?.kind === "video" && (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-pressed={!muted}
              aria-label={muted ? t("unmute") : t("mute")}
              className="press flex h-12 w-12 items-center justify-center rounded-full border border-paper/15 bg-basalt/85 text-paper shadow-lg"
            >
              {muted ? (
                <VolumeX aria-hidden="true" className="h-5 w-5" />
              ) : (
                <Volume2 aria-hidden="true" className="h-5 w-5" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={toggleUi}
            aria-pressed={uiHidden}
            aria-label={uiHidden ? t("showUi") : t("hideUi")}
            className="press flex h-12 w-12 items-center justify-center rounded-full border border-paper/15 bg-basalt/85 text-paper shadow-lg"
          >
            {uiHidden ? (
              <Eye aria-hidden="true" className="h-5 w-5" />
            ) : (
              <EyeOff aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setPlaying((v) => !v)}
            aria-label={playing ? t("pauseTour") : t("playTour")}
            className="press flex h-12 w-12 items-center justify-center rounded-full border border-paper/15 bg-basalt/85 text-paper shadow-lg"
          >
            {playing ? (
              <Pause aria-hidden="true" className="h-5 w-5" fill="currentColor" />
            ) : (
              <Play aria-hidden="true" className="h-5 w-5" fill="currentColor" />
            )}
          </button>
        </div>
      </div>

      {/* Always-available way back when everything is hidden (keyboard/SR). */}
      {uiHidden && (
        <button
          type="button"
          onClick={toggleUi}
          className="sr-only focus:not-sr-only focus:absolute focus:end-3 focus:top-3 focus:z-20 focus:rounded-full focus:bg-paper focus:px-4 focus:py-2 focus:text-basalt"
        >
          {t("showUi")}
        </button>
      )}

      <p aria-live="polite" className="sr-only">
        {t("slideOf", { current: current + 1, total: slides.length })}
      </p>
    </div>
  );
}
