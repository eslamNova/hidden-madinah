"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { hasVerifyMarker, parseTransportOptions, type TransportOption } from "@/lib/content";
import type { Enums, Tables } from "@/lib/database.types";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/maps";
import {
  deletePlaceAction,
  savePlaceAction,
  type PlaceFormInput,
} from "@/app/admin/(protected)/actions";
import { PinPicker, type PinChange } from "@/components/admin/PinPicker";
import { MediaUploader } from "@/components/admin/MediaUploader";
import { MediaList } from "@/components/admin/MediaList";

type PlaceRow = Tables<"places">;

const inputClass =
  "min-h-[52px] w-full rounded-xl border-[1.5px] border-ink/30 bg-surface px-4 text-lg";
const flaggedClass = "ring-2 ring-accent border-accent";

function FieldShell({
  id,
  label,
  flagged,
  flaggedHint,
  children,
}: {
  id: string;
  label: string;
  flagged: boolean;
  flaggedHint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-base font-semibold">
        {label}
      </label>
      {children}
      {flagged && <p className="mt-1 text-sm text-muted">{flaggedHint}</p>}
    </div>
  );
}

/** Single-owner place editor — all Content Pack fields, mobile-first. */
export function PlaceForm({
  place,
  media,
}: {
  place: PlaceRow | null;
  media: Tables<"media">[];
}) {
  const t = useTranslations("admin");
  const router = useRouter();

  const [form, setForm] = useState(() => ({
    slug: place?.slug ?? "",
    name_ar: place?.name_ar ?? "",
    name_en: place?.name_en ?? "",
    category: (place?.category ?? "mosque") as Enums<"place_category">,
    is_published: place?.is_published ?? false,
    featured: place?.featured ?? false,
    summary_ar: place?.summary_ar ?? "",
    story_ar: place?.story_ar ?? "",
    virtue_ar: place?.virtue_ar ?? "",
    featured_quote_ar: place?.featured_quote_ar ?? "",
    featured_quote_source_ar: place?.featured_quote_source_ar ?? "",
    how_to_get_there_ar: place?.how_to_get_there_ar ?? "",
    transport_note_ar: place?.transport_note_ar ?? "",
    best_time_ar: place?.best_time_ar ?? "",
    open_status_ar: place?.open_status_ar ?? "",
    visiting_tips_ar: place?.visiting_tips_ar ?? "",
    google_maps_url: place?.google_maps_url ?? "",
    related_slugs: (place?.related_place_slugs ?? []).join(", "),
    admin_notes_ar: place?.admin_notes_ar ?? "",
    lat: place?.lat != null ? String(place.lat) : "",
    lng: place?.lng != null ? String(place.lng) : "",
    distance:
      place?.distance_from_prophets_mosque_km != null
        ? String(place.distance_from_prophets_mosque_km)
        : "",
    driveTime:
      place?.drive_time_from_haram_min != null
        ? String(place.drive_time_from_haram_min)
        : "",
  }));
  const [transport, setTransport] = useState<TransportOption[]>(() =>
    parseTransportOptions(place?.transport_options ?? null)
  );
  const [exifSuggestion, setExifSuggestion] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [distanceHint, setDistanceHint] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<"saved" | "error" | null>(null);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const text = (
    id: keyof typeof form & string,
    label: string,
    opts: { rows?: number; dir?: "ltr"; type?: string } = {}
  ) => {
    const value = form[id] as string;
    const flagged = hasVerifyMarker(value);
    const className = `${inputClass} ${flagged ? flaggedClass : ""}`;
    return (
      <FieldShell
        id={id}
        label={label}
        flagged={flagged}
        flaggedHint={t("flaggedField")}
      >
        {opts.rows ? (
          <textarea
            id={id}
            rows={opts.rows}
            value={value}
            onChange={set(id)}
            className={`${className} py-3 leading-relaxed`}
          />
        ) : (
          <input
            id={id}
            type={opts.type ?? "text"}
            dir={opts.dir}
            value={value}
            onChange={set(id)}
            className={className}
          />
        )}
      </FieldShell>
    );
  };

  function onPinChange(change: PinChange) {
    setForm((f) => ({
      ...f,
      lat: String(change.lat),
      lng: String(change.lng),
      distance: f.distance.trim() === "" ? String(change.suggestedKm) : f.distance,
    }));
    setDistanceHint(change.suggestedKm);
    setExifSuggestion(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const toNull = (s: string) => (s.trim() === "" ? null : s.trim());
    const toNum = (s: string) => (s.trim() === "" ? null : Number(s));

    const input: PlaceFormInput = {
      id: place?.id,
      slug: form.slug.trim(),
      name_ar: form.name_ar.trim(),
      name_en: toNull(form.name_en),
      category: form.category,
      is_published: form.is_published,
      featured: form.featured,
      summary_ar: toNull(form.summary_ar),
      story_ar: toNull(form.story_ar),
      virtue_ar: toNull(form.virtue_ar),
      featured_quote_ar: toNull(form.featured_quote_ar),
      featured_quote_source_ar: toNull(form.featured_quote_source_ar),
      how_to_get_there_ar: toNull(form.how_to_get_there_ar),
      transport_options: transport.filter((o) => o.mode_ar.trim() !== ""),
      transport_note_ar: toNull(form.transport_note_ar),
      best_time_ar: toNull(form.best_time_ar),
      open_status_ar: toNull(form.open_status_ar),
      visiting_tips_ar: toNull(form.visiting_tips_ar),
      google_maps_url: toNull(form.google_maps_url),
      related_place_slugs: form.related_slugs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      admin_notes_ar: toNull(form.admin_notes_ar),
      lat: toNum(form.lat),
      lng: toNum(form.lng),
      distance_from_prophets_mosque_km: toNum(form.distance),
      drive_time_from_haram_min: toNum(form.driveTime),
    };

    const result = await savePlaceAction(input);
    setSaving(false);
    if (!result.ok) {
      setMessage("error");
      return;
    }
    if (!place) {
      router.push(`/admin/places/${result.data.id}`);
      return;
    }
    setMessage("saved");
    router.refresh();
  }

  async function onDelete() {
    if (!place) return;
    if (!window.confirm(t("confirmDelete"))) return;
    await deletePlaceAction(place.id);
  }

  const lat = form.lat.trim() === "" ? null : Number(form.lat);
  const lng = form.lng.trim() === "" ? null : Number(form.lng);

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-10 pb-8">
      {/* Basic */}
      <section className="space-y-5">
        {text("name_ar", t("fields.nameAr"))}
        {text("name_en", t("fields.nameEn"), { dir: "ltr" })}
        <FieldShell id="slug" label={t("fields.slug")} flagged={false} flaggedHint="">
          <input
            id="slug"
            type="text"
            dir="ltr"
            required
            pattern="[a-z0-9\-]+"
            value={form.slug}
            onChange={set("slug")}
            className={inputClass}
          />
          <p className="mt-1 text-sm text-muted">{t("fields.slugHint")}</p>
        </FieldShell>
        <FieldShell id="category" label={t("fields.category")} flagged={false} flaggedHint="">
          <select
            id="category"
            value={form.category}
            onChange={set("category")}
            className={inputClass}
          >
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].labelAr}
              </option>
            ))}
          </select>
        </FieldShell>
        <div className="space-y-3">
          <label className="flex min-h-12 items-center gap-3 text-lg">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
              className="h-6 w-6 accent-[#1F5C3D]"
            />
            {t("fields.isPublished")}
          </label>
          <label className="flex min-h-12 items-center gap-3 text-lg">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
              className="h-6 w-6 accent-[#1F5C3D]"
            />
            {t("fields.featured")}
          </label>
        </div>
      </section>

      {/* Content */}
      <section className="space-y-5">
        {text("summary_ar", t("fields.summary"), { rows: 3 })}
        {text("story_ar", t("fields.story"), { rows: 8 })}
        {text("virtue_ar", t("fields.virtue"), { rows: 4 })}
        {text("featured_quote_ar", t("fields.featuredQuote"), { rows: 3 })}
        {text("featured_quote_source_ar", t("fields.featuredQuoteSource"))}
        {text("visiting_tips_ar", t("fields.tips"), { rows: 4 })}
      </section>

      {/* Logistics */}
      <section className="space-y-5">
        {text("how_to_get_there_ar", t("fields.howToGet"), { rows: 3 })}

        <fieldset className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-4">
          <legend className="px-1 text-base font-semibold">
            {t("transportOptions.title")}
          </legend>
          {transport.map((option, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-ink/10 p-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-muted">
                  {t("transportOptions.mode")}
                </span>
                <input
                  type="text"
                  value={option.mode_ar}
                  onChange={(e) =>
                    setTransport((prev) =>
                      prev.map((o, j) => (j === i ? { ...o, mode_ar: e.target.value } : o))
                    )
                  }
                  className={inputClass}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-muted">
                    {t("transportOptions.min")}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={option.min_sar ?? ""}
                    onChange={(e) =>
                      setTransport((prev) =>
                        prev.map((o, j) =>
                          j === i
                            ? {
                                ...o,
                                min_sar:
                                  e.target.value === "" ? undefined : Number(e.target.value),
                              }
                            : o
                        )
                      )
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-muted">
                    {t("transportOptions.max")}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={option.max_sar ?? ""}
                    onChange={(e) =>
                      setTransport((prev) =>
                        prev.map((o, j) =>
                          j === i
                            ? {
                                ...o,
                                max_sar:
                                  e.target.value === "" ? undefined : Number(e.target.value),
                              }
                            : o
                        )
                      )
                    }
                    className={inputClass}
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-muted">
                  {t("transportOptions.note")}
                </span>
                <input
                  type="text"
                  value={option.note_ar ?? ""}
                  onChange={(e) =>
                    setTransport((prev) =>
                      prev.map((o, j) =>
                        j === i ? { ...o, note_ar: e.target.value || undefined } : o
                      )
                    )
                  }
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={() => setTransport((prev) => prev.filter((_, j) => j !== i))}
                className="flex min-h-12 items-center gap-2 rounded-xl border-[1.5px] border-ink/30 bg-surface px-4 font-medium"
              >
                <Trash2 aria-hidden="true" className="h-5 w-5" />
                {t("transportOptions.remove")}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setTransport((prev) => [...prev, { mode_ar: "" }])}
            className="flex min-h-12 items-center gap-2 rounded-xl border-[1.5px] border-ink/30 bg-surface px-4 font-medium"
          >
            <Plus aria-hidden="true" className="h-5 w-5" />
            {t("transportOptions.add")}
          </button>
        </fieldset>

        {text("transport_note_ar", t("fields.transportNote"))}
        {text("best_time_ar", t("fields.bestTime"))}
        {text("open_status_ar", t("fields.openStatus"))}
        <div className="grid grid-cols-2 gap-3">
          {text("distance", t("fields.distanceKm"), { type: "number", dir: "ltr" })}
          {text("driveTime", t("fields.driveTimeMin"), { type: "number", dir: "ltr" })}
        </div>
        {distanceHint != null && (
          <p className="rounded-xl bg-sand p-3 text-base">
            {t("pin.distanceAuto", { km: distanceHint })}
          </p>
        )}
      </section>

      {/* Location */}
      <section className="space-y-5">
        <h3 className="text-lg font-semibold">{t("pin.title")}</h3>
        <PinPicker
          lat={Number.isFinite(lat) ? lat : null}
          lng={Number.isFinite(lng) ? lng : null}
          exifSuggestion={exifSuggestion}
          onChange={onPinChange}
        />
        <div className="grid grid-cols-2 gap-3">
          {text("lat", t("fields.lat"), { type: "number", dir: "ltr" })}
          {text("lng", t("fields.lng"), { type: "number", dir: "ltr" })}
        </div>
        {text("google_maps_url", t("fields.googleMapsUrl"), { dir: "ltr" })}
        {text("related_slugs", t("fields.relatedSlugs"), { dir: "ltr" })}
        {text("admin_notes_ar", t("fields.adminNotes"), { rows: 4 })}
      </section>

      {/* Media (edit mode only — uploads need the place id) */}
      {place && (
        <section className="space-y-5">
          <h3 className="text-lg font-semibold">{t("media.title")}</h3>
          <MediaUploader
            placeId={place.id}
            placeSlug={form.slug}
            nextSortOrder={media.length}
            onExifGps={(gps) => setExifSuggestion(gps)}
          />
          <MediaList media={media} placeSlug={form.slug} />
        </section>
      )}

      {/* Sticky save bar */}
      <div className="sticky bottom-20 z-30 flex items-center gap-3 rounded-2xl border border-ink/10 bg-surface/95 p-3 shadow-lg backdrop-blur">
        <button
          type="submit"
          disabled={saving}
          className="flex min-h-14 flex-1 items-center justify-center rounded-2xl bg-primary px-6 text-lg font-semibold text-paper disabled:opacity-60"
        >
          {saving ? t("saving") : t("save")}
        </button>
        {place && (
          <button
            type="button"
            onClick={() => void onDelete()}
            className="flex min-h-14 items-center justify-center rounded-2xl border-[1.5px] border-ink/30 bg-surface px-5 text-lg font-medium"
          >
            {t("delete")}
          </button>
        )}
        <p aria-live="polite" className="sr-only sm:not-sr-only sm:text-base sm:text-muted">
          {message === "saved" ? t("saved") : message === "error" ? t("saveError") : ""}
        </p>
      </div>
    </form>
  );
}