"use client";

import { useTranslations } from "next-intl";
import { BookOpen, Landmark, MapPin } from "lucide-react";
import Link from "@/components/i18n/Link";
import type { Lang } from "@/lib/i18n";
import type { HumaneStory } from "@/lib/stories";

/** One verified story: its text, its themes, its place, and where it is in the book. */
export function StoryCard({ story, lang }: { story: HumaneStory; lang: Lang }) {
  const t = useTranslations("stories");
  const ref = story.hadithRef ? `${story.hadithRef}${story.grading ? ` (${story.grading})` : ""}` : null;

  return (
    <article className="card-elevated space-y-4 border-s-4 border-s-accent/70 p-5">
      {story.themes.length > 0 && (
        <ul aria-label={t("themesLabel")} className="flex flex-wrap gap-2">
          {story.themes.map((theme) => (
            <li key={theme} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-brand">
              {t(`themes.${theme}`)}
            </li>
          ))}
        </ul>
      )}

      <p className="text-lg leading-loose">{story.text}</p>

      <footer className="space-y-1 border-t border-ink/10 pt-3">
        {story.place ? (
          <Link
            href={`/places/${encodeURIComponent(story.place.slug)}`}
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
          >
            <MapPin aria-hidden="true" className="h-5 w-5 shrink-0" />
            {t("placeLink", { name: story.place.name })}
          </Link>
        ) : (
          story.topic && (
            <p className="flex min-h-11 items-center gap-2 font-semibold">
              <Landmark aria-hidden="true" className="h-5 w-5 shrink-0 text-brand" />
              {t(`topics.${story.topic}`)}
            </p>
          )
        )}
        <p className="flex items-start gap-2 text-base text-muted">
          <BookOpen aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
          <span>
            {t("source", { vol: story.vol ?? "?", page: story.page ?? "?" })}
            {ref &&
              (lang === "ar" ? (
                ` · ${ref}`
              ) : (
                // Narration references stay as written in the source (Arabic).
                <>
                  {" · "}
                  <bdi lang="ar">{ref}</bdi>
                </>
              ))}
          </span>
        </p>
      </footer>
    </article>
  );
}
