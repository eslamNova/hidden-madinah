"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useLang } from "@/lib/use-lang";
import type { HumaneStory, StoryTheme, StoryThemeGroup } from "@/lib/stories";
import { StoryCard } from "./StoryCard";

type Filter = StoryTheme | "all";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`press inline-flex min-h-12 items-center gap-2 rounded-full border-[1.5px] px-4 text-base font-medium transition-colors duration-150 ${
        active ? "border-primary bg-primary text-paper" : "border-ink/15 bg-surface text-ink shadow-sm"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={`ltr-nums min-w-7 rounded-full px-2 text-center text-sm font-semibold ${
        active ? "bg-paper/20 text-paper" : "bg-primary/10 text-brand"
      }`}
    >
      {n}
    </span>
  );
}

/**
 * Theme chips over the story list. The chosen theme is kept in ?theme= so a
 * filtered list can be shared or linked to (e.g. /stories?theme=mercy).
 */
export function StoryBrowser({ stories, groups }: { stories: HumaneStory[]; groups: StoryThemeGroup[] }) {
  const t = useTranslations("stories");
  const lang = useLang();
  const [active, setActive] = useState<Filter>("all");

  // Read the link's theme after hydration (the page itself is static).
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("theme");
    const group = groups.find((g) => g.theme === wanted);
    if (group) setActive(group.theme);
  }, [groups]);

  const choose = (next: Filter) => {
    setActive(next);
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("theme");
    else url.searchParams.set("theme", next);
    window.history.replaceState(window.history.state, "", url);
  };

  const shown = useMemo(() => {
    if (active === "all") return stories;
    const ids = new Set(groups.find((g) => g.theme === active)?.ids ?? []);
    return stories.filter((s) => ids.has(s.id));
  }, [active, stories, groups]);

  return (
    <div className="space-y-6">
      {groups.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-base font-semibold">{t("filterLabel")}</legend>
          <div className="flex flex-wrap gap-2">
            <Chip active={active === "all"} onClick={() => choose("all")}>
              {t("all")}
              <Count n={stories.length} active={active === "all"} />
            </Chip>
            {groups.map((g) => (
              <Chip key={g.theme} active={active === g.theme} onClick={() => choose(g.theme)}>
                {t(`themes.${g.theme}`)}
                <Count n={g.count} active={active === g.theme} />
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      <p aria-live="polite" className="text-base text-muted">
        {active === "all" ? t("count", { count: shown.length }) : t("countTheme", { count: shown.length, theme: t(`themes.${active}`) })}
      </p>

      <div className="space-y-5">
        {shown.map((s) => (
          <StoryCard key={s.id} story={s} lang={lang} />
        ))}
      </div>
    </div>
  );
}
