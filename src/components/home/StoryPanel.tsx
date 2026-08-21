"use client";

import type { ReactNode, Ref } from "react";
import { m, type Variants } from "motion/react";
import type { PlaceCategory } from "@/lib/maps";
import { PlaceImage, PlaceholderImage } from "@/components/place/PlaceImage";

import type { CoverImage } from "@/lib/content";

/** Lean photo DTO — the only image shape that crosses the RSC boundary. */
export type StoryPhoto = CoverImage | null;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 120, damping: 20 },
  },
};

/** One staggered reveal unit inside a StoryPanel. */
export function StoryItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <m.div variants={rise} className={className}>
      {children}
    </m.div>
  );
}

/**
 * One full-viewport snap panel. "photo" variant: full-bleed image (or the
 * category placeholder texture) under the house scrims; "plain": bare basalt
 * for grid panels. Text staggers in the first time the parent marks the panel
 * revealed (its IntersectionObserver — motion's own whileInView proved
 * unreliable inside an overflow scroll container). Under reduced motion every
 * panel shows immediately, without movement.
 */
export function StoryPanel({
  ref,
  labelledBy,
  photo = null,
  category = "mosque",
  plain = false,
  priority = false,
  reduceMotion,
  revealed,
  contentClassName = "justify-end",
  children,
}: {
  ref?: Ref<HTMLElement>;
  labelledBy: string;
  photo?: StoryPhoto;
  category?: PlaceCategory;
  plain?: boolean;
  priority?: boolean;
  reduceMotion: boolean;
  revealed: boolean;
  contentClassName?: string;
  children: ReactNode;
}) {
  // Always motion-managed so the SSR'd "hidden" styles are guaranteed to be
  // animated away. Under reduced motion every panel jumps straight to "show"
  // on mount: MotionConfig reducedMotion="user" strips the translate, leaving
  // only a brief opacity fade (reduced-motion-safe).
  const reveal = {
    variants: container,
    initial: "hidden",
    animate: reduceMotion || revealed ? "show" : "hidden",
  } as const;

  return (
    <section
      ref={ref}
      aria-labelledby={labelledBy}
      className="relative h-full w-full shrink-0 snap-start overflow-hidden bg-basalt"
    >
      {!plain &&
        (photo ? (
          <PlaceImage
            media={photo}
            alt=""
            sizes="100vw"
            priority={priority}
            capMobile
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          // Wrapper supplies the absolute positioning: PlaceholderImage's own
          // `relative` class would win the conflict and push the text content
          // below the panel's overflow-hidden edge.
          <div aria-hidden="true" className="absolute inset-0">
            <PlaceholderImage
              category={category}
              className="h-full w-full"
              iconClassName="h-24 w-24"
            />
          </div>
        ))}
      {!plain && <div aria-hidden="true" className="warm-wash absolute inset-0" />}
      {!plain && <div aria-hidden="true" className="scrim-hero absolute inset-0" />}

      {/* pb floor = floating next button clearance (bottom-28 + h-14, rem so it
          tracks the أ+ font steps); the dvh cap + inner scroll keep the largest
          font step reachable on short Android viewports instead of clipping
          off the top of the overflow-hidden panel. */}
      <m.div
        {...reveal}
        className={`relative flex h-full flex-col px-5 pb-[max(10.5rem,min(12.5rem,32dvh))] pt-[min(4rem,6dvh)] ${contentClassName}`}
      >
        <div className="scrollbar-hidden mx-auto max-h-full w-full max-w-3xl space-y-4 overflow-y-auto">
          {children}
        </div>
      </m.div>
    </section>
  );
}
