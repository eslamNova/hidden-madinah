"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "@/components/i18n/Link";
import { useTranslations } from "next-intl";
import {
  BookOpenText,
  ChevronDown,
  ChevronLeft,
  Compass,
  Play,
  Route as RouteIcon,
  Send,
} from "lucide-react";
import { SEERAH_APP, TELEGRAM_CHANNEL } from "@/lib/constants";
import {
  LazyMotion,
  MotionConfig,
  domAnimation,
  useReducedMotion,
} from "motion/react";
import { CATEGORY_META, type PlaceCategory } from "@/lib/maps";
import { CategoryIcon } from "@/components/CategoryIcon";
import { PlaceImage, PlaceholderImage } from "@/components/place/PlaceImage";
import { TelegramIconLink } from "@/components/layout/TelegramIconLink";
import { StoryItem, StoryPanel, type StoryPhoto } from "./StoryPanel";

export type StoryPlace = {
  slug: string;
  name_ar: string;
  category: PlaceCategory;
  photo: StoryPhoto;
};

export type StoryFeatured = StoryPlace & { tagline: string | null };

export type StoryCategory = {
  category: PlaceCategory;
  count: number;
  photo: StoryPhoto;
};

export type StoryRoute = {
  id: string;
  slug: string;
  title_ar: string;
  stopsCount: number;
  photo: StoryPhoto;
};

/** Everything the story needs — built (and [VERIFY]-stripped) on the server. */
export type StoryData = {
  hero: StoryPlace | null;
  featured: StoryFeatured[];
  categories: StoryCategory[];
  routes: StoryRoute[];
  closingPhoto: StoryPhoto;
};

/**
 * Cinematic story-scroll landing: full-viewport photo panels snapping inside
 * their own scroll container. A floating "next" button advances panels via
 * scrollIntoView (no RTL scroll math); IntersectionObserver tracks the active
 * panel, mirroring the Gallery pattern.
 */
export function StoryLanding({ data }: { data: StoryData }) {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const tPlaces = useTranslations("places");
  const tRoutes = useTranslations("routes");
  const tSeerah = useTranslations("seerah");
  const tTelegram = useTranslations("telegram");
  const reduceMotion = useReducedMotion() ?? false;
  const baseId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  // Panels that have entered view once — their text has revealed and stays.
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));

  const hasRoutes = data.routes.length > 0;
  const featuredStart = 1;
  const categoriesIdx = featuredStart + data.featured.length;
  const routesIdx = hasRoutes ? categoriesIdx + 1 : -1;
  const closingIdx = categoriesIdx + (hasRoutes ? 2 : 1);
  const total = closingIdx + 1;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = panelRefs.current.indexOf(entry.target as HTMLElement);
            if (idx >= 0) {
              setActive(idx);
              setVisited((prev) =>
                prev.has(idx) ? prev : new Set(prev).add(idx)
              );
            }
          }
        }
      },
      { root: containerRef.current, threshold: 0.6 }
    );
    panelRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [total]);

  const refAt = (i: number) => (el: HTMLElement | null) => {
    panelRefs.current[i] = el;
  };

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(total - 1, index));
    panelRefs.current[clamped]?.scrollIntoView({
      // An explicit "smooth" overrides CSS scroll-behavior, so the global
      // reduced-motion rule cannot suppress it — honor the setting here.
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const headingId = (i: number) => `${baseId}-panel-${i}`;

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div className="relative">
          <div
            ref={containerRef}
            tabIndex={0}
            role="region"
            aria-label={t("story.regionLabel")}
            className="story-viewport scrollbar-hidden snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
          >
            {/* Panel 0 — opening title over the strongest photo. */}
            <StoryPanel
              ref={refAt(0)}
              labelledBy={headingId(0)}
              photo={data.hero?.photo ?? null}
              category={data.hero?.category ?? "mosque"}
              priority
              reduceMotion={reduceMotion}
              revealed={visited.has(0)}
            >
              <StoryItem>
                <p className="font-wordmark text-2xl text-accent">
                  {tCommon("siteName")}
                </p>
              </StoryItem>
              <StoryItem>
                <h1
                  id={headingId(0)}
                  className="text-4xl leading-tight text-paper sm:text-5xl"
                >
                  {t("heroTitle")}
                </h1>
              </StoryItem>
              <StoryItem className="pt-3">
                {/* Primary hero action: the photo tour. Solid light surface
                    (reads over any photo) with a slow sheen sweep as the
                    "live" cue — no pulsing. */}
                <Link
                  href="/tour"
                  className="tour-sheen press relative inline-flex min-h-14 items-center gap-3 overflow-hidden rounded-2xl bg-paper px-7 text-lg font-semibold text-primary-dark shadow-lg"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                    <Play
                      aria-hidden="true"
                      className="h-4 w-4 text-paper"
                      fill="currentColor"
                    />
                  </span>
                  {t("tourCta")}
                </Link>
              </StoryItem>
              {data.hero?.photo && (
                <StoryItem>
                  <p className="text-sm text-paper/60">
                    {t("heroCredit", { name: data.hero.name_ar })}
                  </p>
                </StoryItem>
              )}
            </StoryPanel>

            {/* Featured places — one photo, one name, one line. */}
            {data.featured.map((p, i) => {
              const idx = featuredStart + i;
              return (
                <StoryPanel
                  key={p.slug}
                  ref={refAt(idx)}
                  labelledBy={headingId(idx)}
                  photo={p.photo}
                  category={p.category}
                  reduceMotion={reduceMotion}
                  revealed={visited.has(idx)}
                >
                  <StoryItem>
                    <span
                      className="flex items-center gap-2 text-lg font-medium"
                      style={{ color: CATEGORY_META[p.category].tintOnDark }}
                    >
                      <CategoryIcon
                        category={p.category}
                        className="h-6 w-6 shrink-0"
                      />
                      {tPlaces(`category.${p.category}`)}
                    </span>
                  </StoryItem>
                  <StoryItem>
                    <h2
                      id={headingId(idx)}
                      className="text-3xl leading-tight text-paper sm:text-4xl"
                    >
                      {p.name_ar}
                    </h2>
                  </StoryItem>
                  {p.tagline && (
                    <StoryItem>
                      <p className="line-clamp-1 max-w-xl text-lg text-paper/85">
                        {p.tagline}
                      </p>
                    </StoryItem>
                  )}
                  <StoryItem className="pt-1">
                    <Link
                      href={`/places/${encodeURIComponent(p.slug)}`}
                      className="press inline-flex min-h-14 items-center gap-2 rounded-2xl bg-paper px-7 text-lg font-semibold text-primary-dark shadow-lg"
                    >
                      {t("story.openPlace")}
                      <ChevronLeft aria-hidden="true" className="h-5 w-5 ltr:-scale-x-100" />
                    </Link>
                  </StoryItem>
                </StoryPanel>
              );
            })}

            {/* Categories — image tiles on bare basalt. */}
            <StoryPanel
              ref={refAt(categoriesIdx)}
              labelledBy={headingId(categoriesIdx)}
              plain
              reduceMotion={reduceMotion}
              revealed={visited.has(categoriesIdx)}
              contentClassName="justify-center"
            >
              <StoryItem>
                <h2
                  id={headingId(categoriesIdx)}
                  className="text-3xl text-paper"
                >
                  {t("categoriesTitle")}
                </h2>
                <span aria-hidden="true" className="gold-rule mt-2 block h-px w-16" />
              </StoryItem>
              <StoryItem className="pt-2">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                  {data.categories.map((c) => (
                    <Link
                      key={c.category}
                      href={`/places?category=${c.category}`}
                      className="card-lift relative block overflow-hidden rounded-2xl bg-basalt shadow-md"
                    >
                      {c.photo ? (
                        <PlaceImage
                          media={c.photo}
                          alt=""
                          sizes="(max-width: 640px) 45vw, 200px"
                          className="aspect-[3/2] w-full object-cover"
                        />
                      ) : (
                        <PlaceholderImage
                          category={c.category}
                          className="aspect-[3/2] w-full"
                        />
                      )}
                      <div aria-hidden="true" className="scrim absolute inset-0" />
                      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-3">
                        <CategoryIcon
                          category={c.category}
                          className="h-6 w-6 shrink-0 text-paper"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-base font-semibold text-paper">
                            {tPlaces(`categoryPlural.${c.category}`)}
                          </span>
                          <span className="block text-sm text-paper/75">
                            {tPlaces("count", { count: c.count })}
                          </span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </StoryItem>
            </StoryPanel>

            {/* Curated routes — covers only, no descriptions. */}
            {hasRoutes && (
              <StoryPanel
                ref={refAt(routesIdx)}
                labelledBy={headingId(routesIdx)}
                plain
                reduceMotion={reduceMotion}
                revealed={visited.has(routesIdx)}
                contentClassName="justify-center"
              >
                <StoryItem>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h2
                        id={headingId(routesIdx)}
                        className="text-3xl text-paper"
                      >
                        {t("routesTitle")}
                      </h2>
                      <span
                        aria-hidden="true"
                        className="gold-rule mt-2 block h-px w-16"
                      />
                    </div>
                    <Link
                      href="/routes"
                      className="flex min-h-12 items-center gap-1 font-medium text-paper/85"
                    >
                      {tCommon("viewAll")}
                      <ChevronLeft aria-hidden="true" className="h-5 w-5 ltr:-scale-x-100" />
                    </Link>
                  </div>
                </StoryItem>
                <StoryItem className="pt-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {data.routes.map((r) => (
                      <Link
                        key={r.id}
                        href={`/routes/${encodeURIComponent(r.slug)}`}
                        className="card-lift relative block overflow-hidden rounded-2xl bg-basalt shadow-md"
                      >
                        {r.photo ? (
                          <PlaceImage
                            media={r.photo}
                            alt=""
                            sizes="(max-width: 640px) 92vw, 420px"
                            capMobile
                            className="aspect-[16/9] w-full object-cover"
                          />
                        ) : (
                          <PlaceholderImage
                            category="mosque"
                            className="aspect-[16/9] w-full"
                          />
                        )}
                        <div aria-hidden="true" className="scrim absolute inset-0" />
                        <div className="absolute inset-x-0 bottom-0 space-y-1 p-4">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-accent">
                            <RouteIcon aria-hidden="true" className="h-4 w-4" />
                            {tRoutes("stopsCount", { count: r.stopsCount })}
                          </span>
                          <span className="block text-xl font-bold text-paper">
                            {r.title_ar}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </StoryItem>
              </StoryPanel>
            )}

            {/* Closing — the invitation. */}
            <StoryPanel
              ref={refAt(closingIdx)}
              labelledBy={headingId(closingIdx)}
              photo={data.closingPhoto}
              category={data.hero?.category ?? "mosque"}
              reduceMotion={reduceMotion}
              revealed={visited.has(closingIdx)}
              bottom="dock"
            >
              <StoryItem>
                <p className="font-wordmark text-2xl text-accent">
                  {tCommon("siteName")}
                </p>
              </StoryItem>
              <StoryItem>
                <h2
                  id={headingId(closingIdx)}
                  className="text-3xl leading-tight text-paper sm:text-4xl"
                >
                  {t("story.closingTitle")}
                </h2>
              </StoryItem>
              <StoryItem className="pt-1">
                <div className="flex flex-col gap-3">
                  {/* The tour leads the farewell too — same sheen CTA as the
                      opening panel, so the story ends where it can restart. */}
                  <Link
                    href="/tour"
                    className="tour-sheen press relative flex min-h-14 items-center justify-center gap-3 overflow-hidden rounded-2xl bg-paper px-7 text-lg font-semibold text-primary-dark shadow-lg sm:self-start"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                      <Play
                        aria-hidden="true"
                        className="h-4 w-4 text-paper"
                        fill="currentColor"
                      />
                    </span>
                    {t("tourCta")}
                  </Link>
                  {/* Secondary pair shares one row so the stack fits above the
                      dock with the companion card still in view. */}
                  <div className="grid grid-cols-2 gap-3 sm:flex">
                    <Link
                      href="/places"
                      className="press flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-paper px-4 text-lg font-semibold text-primary-dark shadow-lg sm:px-8"
                    >
                      <Compass aria-hidden="true" className="h-6 w-6 shrink-0" />
                      {t("heroCta")}
                    </Link>
                    {/* No backdrop-blur: the panel's scrims already guarantee
                        legibility, and blur over scrolling imagery costs frames. */}
                    <Link
                      href="/map"
                      className="press flex min-h-14 items-center justify-center rounded-2xl border-[1.5px] border-paper/70 px-4 text-lg font-semibold text-paper sm:px-8"
                    >
                      {t("heroMapCta")}
                    </Link>
                  </div>
                </div>
              </StoryItem>
              <StoryItem className="pt-3">
                {/* Companion app, compact dark variant — the farewell is
                    "continue your journey", and «سيرة» is where it continues. */}
                <div className="flex flex-col gap-2.5 rounded-2xl border border-paper/15 bg-basalt/60 p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent"
                  >
                    <BookOpenText className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 sm:flex-1">
                    <p className="text-base font-semibold text-paper">{tSeerah("title")}</p>
                    <p className="text-sm text-paper/75">{tSeerah("short")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={SEERAH_APP.appStore}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="press inline-flex min-h-12 items-center rounded-xl border border-paper/30 px-4 text-sm font-semibold text-paper"
                    >
                      {tSeerah("appStore")}
                    </a>
                    <a
                      href={SEERAH_APP.googlePlay}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="press inline-flex min-h-12 items-center rounded-xl border border-paper/30 px-4 text-sm font-semibold text-paper"
                    >
                      {tSeerah("googlePlay")}
                    </a>
                  </div>
                </div>
              </StoryItem>
              <StoryItem className="pt-2">
                {/* Channel invite, one slim row on purpose — the closing panel
                    already carries three CTAs and the companion card, and the
                    whole stack has to clear the dock on a 667px screen. */}
                <a
                  href={TELEGRAM_CHANNEL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press inline-flex min-h-12 items-center gap-2.5 rounded-2xl border border-paper/20 bg-basalt/50 px-4 text-paper"
                >
                  <Send aria-hidden="true" className="h-5 w-5 shrink-0 text-accent" />
                  <span className="text-sm font-semibold">{tTelegram("short")}</span>
                  <ChevronLeft aria-hidden="true" className="h-4 w-4 shrink-0 opacity-60 ltr:-scale-x-100" />
                </a>
              </StoryItem>
            </StoryPanel>
          </div>

          {/* Channel icon, pinned over the story rather than inside a panel:
              the landing's only other Telegram link is on the closing panel,
              which most visitors never reach. Inline-end top corner (physical
              left in RTL), mirroring the floating أ control. */}
          <TelegramIconLink className="absolute end-2 top-[max(env(safe-area-inset-top),0.5rem)] z-10" />

          {/* Floating controls over the scroll container. No backdrop-blur —
              re-blurring the moving photos every frame is what mid-range GPUs
              choke on during the signature scroll. Hint and next-button fade
              instead of blinking in and out. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 flex flex-col items-center gap-2">
            <span
              aria-hidden="true"
              className={`rounded-full bg-basalt/75 px-4 py-1 text-sm text-paper transition-opacity duration-300 ${
                active === 0 ? "opacity-100" : "opacity-0"
              }`}
            >
              {t("story.scrollHint")}
            </span>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              aria-label={t("story.next")}
              tabIndex={active === total - 1 ? -1 : 0}
              className={`press flex h-14 w-14 items-center justify-center rounded-full bg-paper text-basalt shadow-lg transition-opacity duration-300 ${
                active === total - 1
                  ? "pointer-events-none opacity-0"
                  : "pointer-events-auto opacity-100"
              }`}
            >
              <ChevronDown
                aria-hidden="true"
                className={`h-7 w-7 ${active === 0 ? "story-hint" : ""}`}
              />
            </button>
          </div>

          {/* Progress dots — decorative; the live region below announces. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute end-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2"
          >
            {/* iOS page-indicator idiom: the active dot grows, transform-only. */}
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full transition-[background-color,transform] duration-300 ease-out ${
                  i === active ? "scale-[1.4] bg-paper" : "bg-paper/40"
                }`}
              />
            ))}
          </div>

          <p aria-live="polite" className="sr-only">
            {t("story.panelOf", { current: active + 1, total })}
          </p>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
