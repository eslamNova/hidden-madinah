"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

export type JourneyTagOption = { value: string; label: string };
export type JourneyFilterItem = { id: string; tags: string[]; card: ReactNode };

/**
 * The journeys list with tag chips above it ("All" + every tag in use).
 * Cards are rendered on the server and passed in; filtering only hides them,
 * so nothing reloads. The chip row stays out of the way for a single journey
 * or when no journey is tagged.
 */
export function JourneyTagFilter({ items, tags }: { items: JourneyFilterItem[]; tags: JourneyTagOption[] }) {
  const t = useTranslations("journey");
  const [active, setActive] = useState<string | null>(null);
  const showChips = items.length >= 2 && tags.length > 0;
  // A tag can only be active while a chip for it exists.
  const current = showChips && tags.some((tag) => tag.value === active) ? active : null;
  const matches = (item: JourneyFilterItem) => current === null || item.tags.includes(current);
  const count = items.filter(matches).length;

  const chip = (value: string | null, label: string) => (
    <button
      key={value ?? "*all"}
      type="button"
      aria-pressed={current === value}
      onClick={() => setActive(value)}
      className={`min-h-11 rounded-full border px-4 py-2 font-medium ${
        current === value ? "border-primary bg-primary text-paper" : "border-ink/15 bg-surface"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      {showChips && (
        <div className="space-y-2">
          <div role="group" aria-label={t("filterLabel")} className="flex flex-wrap gap-2">
            {chip(null, t("filterAll"))}
            {tags.map((tag) => chip(tag.value, tag.label))}
          </div>
          <p aria-live="polite" className="min-h-6 text-sm text-muted">
            {current !== null && t("filterCount", { count })}
          </p>
        </div>
      )}
      {/* gap, not space-y: hidden cards must not leave their margin behind. */}
      <ul className="flex flex-col gap-5">
        {items.map((item) => (
          <li key={item.id} hidden={!matches(item)}>
            {item.card}
          </li>
        ))}
      </ul>
    </>
  );
}
