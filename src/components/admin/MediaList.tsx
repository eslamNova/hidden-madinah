"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, Film, Trash2 } from "lucide-react";
import type { Tables } from "@/lib/database.types";
import { PlaceImage } from "@/components/place/PlaceImage";
import {
  deleteMediaAction,
  reorderMediaAction,
  updateMediaCaptionAction,
} from "@/app/admin/(protected)/actions";

type MediaRow = Tables<"media">;

/** Admin media manager: caption edit, ▲/▼ reorder, delete. */
export function MediaList({
  media,
  placeSlug,
}: {
  media: MediaRow[];
  placeSlug: string;
}) {
  const t = useTranslations("admin.media");
  const router = useRouter();

  if (media.length === 0) {
    return <p className="rounded-xl bg-surface p-4 text-muted">{t("empty")}</p>;
  }

  async function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= media.length) return;
    const ids = media.map((m) => m.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await reorderMediaAction(ids, placeSlug);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm(t("remove") + "؟")) return;
    await deleteMediaAction(id, placeSlug);
    router.refresh();
  }

  return (
    <ul className="space-y-3">
      {media.map((m, i) => (
        <li
          key={m.id}
          className="flex flex-wrap items-start gap-3 rounded-2xl border border-ink/10 bg-surface p-3"
        >
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-sand">
            {m.thumb_url ? (
              <PlaceImage
                media={{ url: m.thumb_url, width: m.width, height: m.height }}
                alt={m.caption_ar ?? ""}
                sizes="96px"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-muted">
                <Film aria-hidden="true" className="h-8 w-8" />
              </span>
            )}
            {m.type === "video" && (
              <span className="absolute bottom-1 end-1 rounded bg-basalt/80 p-1 text-paper">
                <Film aria-hidden="true" className="h-4 w-4" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-muted">
                {t("caption")}
              </span>
              <input
                type="text"
                defaultValue={m.caption_ar ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (m.caption_ar ?? "")) {
                    void updateMediaCaptionAction(m.id, e.target.value, placeSlug).then(
                      () => router.refresh()
                    );
                  }
                }}
                className="min-h-[52px] w-full rounded-xl border-[1.5px] border-ink/30 bg-surface px-3 text-lg"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void move(i, -1)}
              disabled={i === 0}
              aria-label={t("moveUp")}
              className="flex h-12 w-12 items-center justify-center rounded-xl border-[1.5px] border-ink/30 bg-surface disabled:opacity-40"
            >
              <ChevronUp aria-hidden="true" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => void move(i, 1)}
              disabled={i === media.length - 1}
              aria-label={t("moveDown")}
              className="flex h-12 w-12 items-center justify-center rounded-xl border-[1.5px] border-ink/30 bg-surface disabled:opacity-40"
            >
              <ChevronDown aria-hidden="true" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => void remove(m.id)}
              aria-label={t("remove")}
              className="flex h-12 w-12 items-center justify-center rounded-xl border-[1.5px] border-ink/30 bg-surface text-ink"
            >
              <Trash2 aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}