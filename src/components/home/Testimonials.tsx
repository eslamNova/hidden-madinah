"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Quote } from "lucide-react";
import type { Testimonial } from "@/lib/testimonials";

/**
 * «آراء الزوار» — approved visitor testimonials on the landing's dark story
 * panel. Cards sit in one horizontal snap row (a vertical scroller inside the
 * vertical snap container would fight it for every swipe); the next card
 * peeks in as the cue. Each card shows a clamped excerpt and opens in place.
 * Every language is shown: the visitor's words carry their own lang/dir.
 */
export function Testimonials({ items }: { items: Testimonial[] }) {
  const t = useTranslations("home.testimonials");
  if (items.length === 0) return null;
  const single = items.length === 1;
  return (
    <div className="space-y-2">
      {!single && <p className="text-sm text-paper/75">{t("swipeHint")}</p>}
      <ul
        tabIndex={single ? undefined : 0}
        aria-label={t("listLabel")}
        className="scrollbar-hidden flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1"
      >
        {items.map((item) => (
          <TestimonialCard key={item.id} item={item} wide={single} />
        ))}
      </ul>
    </div>
  );
}

function TestimonialCard({ item, wide }: { item: Testimonial; wide: boolean }) {
  const t = useTranslations("home.testimonials");
  const bodyRef = useRef<HTMLQuoteElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  // Offer "read all" only when the excerpt is actually cut. Measured, not
  // guessed from length: it depends on the card width and the أ font step.
  // The observer also covers the panel's content-visibility: until the panel
  // nears the viewport it has no layout, and the first real size arrives here.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || expanded) return;
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded]);

  const dir = item.lang === "en" ? "ltr" : item.lang === "ar" ? "rtl" : "auto";
  return (
    <li
      className={`flex shrink-0 snap-start flex-col gap-3 rounded-2xl border border-paper/15 bg-paper/[0.07] p-5 text-paper ${
        wide ? "w-full" : "w-[85%] sm:w-[22rem]"
      }`}
    >
      <Quote aria-hidden="true" className="h-7 w-7 shrink-0 text-accent" />
      <blockquote
        ref={bodyRef}
        lang={item.lang ?? undefined}
        dir={dir}
        className={`whitespace-pre-line text-start text-lg leading-relaxed ${expanded ? "" : "line-clamp-6"}`}
      >
        {item.body}
      </blockquote>
      {(clamped || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="min-h-11 self-start rounded-xl px-1 font-semibold text-paper underline underline-offset-4"
        >
          {expanded ? t("showLess") : t("readAll")}
        </button>
      )}
      <p className="mt-auto text-base font-semibold text-accent">
        {/* A typed name is the visitor's own text; its direction follows it. */}
        {item.name ? <bdi dir="auto">{item.name}</bdi> : t("anonymous")}
      </p>
    </li>
  );
}
