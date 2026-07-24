"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import exifr from "exifr";
import { ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  IMAGE_VARIANT_WIDTHS,
  JPEG_QUALITY,
  LARGEST_VARIANT_WIDTH,
  MEDIA_BUCKET,
  mediaObjectPath,
  THUMB_VARIANT_WIDTH,
  WEBP_QUALITY,
} from "@/lib/media-spec";
import { saveMediaRowAction } from "@/app/admin/(protected)/actions";

type ItemStatus = "processing" | "uploading" | "done" | "failed";
type Item = { key: string; name: string; status: ItemStatus; file: File };

let webpProbe: Promise<boolean> | null = null;
function canEncodeWebp(): Promise<boolean> {
  if (!webpProbe) {
    webpProbe = new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      canvas.toBlob((b) => resolve(!!b && b.type === "image/webp"), "image/webp");
    });
  }
  return webpProbe;
}

function randomBase(): string {
  return [...crypto.getRandomValues(new Uint8Array(5))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function encodeResized(
  bitmap: ImageBitmap,
  targetWidth: number,
  mime: string,
  quality: number
): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, targetWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, quality)
  );
  if (!blob) throw new Error("encode failed");
  return { blob, width, height };
}

/**
 * Field-friendly uploader: reads EXIF GPS before processing (to pre-fill the
 * pin), then canvas-resizes to the shared variant spec. The canvas re-encode
 * inherently strips all EXIF (incl. GPS) from every published file.
 */
export function MediaUploader({
  placeId,
  placeSlug,
  nextSortOrder,
  onExifGps,
}: {
  placeId: string;
  placeSlug: string;
  nextSortOrder: number;
  onExifGps?: (gps: { lat: number; lng: number }) => void;
}) {
  const t = useTranslations("admin.media");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const sortCounter = useRef(nextSortOrder);

  const setStatus = (key: string, status: ItemStatus) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, status } : it)));

  async function uploadPhoto(file: File) {
    const supabase = createClient();
    const gps = await exifr.gps(file).catch(() => null);
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
      onExifGps?.({ lat: gps.latitude, lng: gps.longitude });
    }

    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      const useWebp = await canEncodeWebp();
      const ext = useWebp ? "webp" : "jpg";
      const mime = useWebp ? "image/webp" : "image/jpeg";
      const quality = (useWebp ? WEBP_QUALITY : JPEG_QUALITY) / 100;
      const base = randomBase();

      let mainUrl = "";
      let thumbUrl = "";
      let mainWidth = 0;
      let mainHeight = 0;

      for (const w of IMAGE_VARIANT_WIDTHS) {
        const { blob, width, height } = await encodeResized(bitmap, w, mime, quality);
        const path = mediaObjectPath(placeId, base, w, ext);
        const { error } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(path, blob, { contentType: mime, upsert: true, cacheControl: "31536000" });
        if (error) throw error;
        const publicUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
        if (w === LARGEST_VARIANT_WIDTH) {
          mainUrl = publicUrl;
          mainWidth = width;
          mainHeight = height;
        }
        if (w === THUMB_VARIANT_WIDTH) thumbUrl = publicUrl;
      }

      if (useWebp) {
        // JPEG fallback at 1600 — used as the OpenGraph image.
        const { blob } = await encodeResized(
          bitmap,
          LARGEST_VARIANT_WIDTH,
          "image/jpeg",
          JPEG_QUALITY / 100
        );
        const { error } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(mediaObjectPath(placeId, base, LARGEST_VARIANT_WIDTH, "jpg"), blob, {
            contentType: "image/jpeg",
            upsert: true,
            cacheControl: "31536000",
          });
        if (error) throw error;
      }

      const result = await saveMediaRowAction(
        {
          place_id: placeId,
          type: "photo",
          provider: "storage",
          url: mainUrl,
          thumb_url: thumbUrl,
          width: mainWidth,
          height: mainHeight,
          sort_order: sortCounter.current++,
        },
        placeSlug
      );
      if (!result.ok) throw new Error(result.error);
    } finally {
      bitmap.close();
    }
  }

  async function uploadVideo(file: File) {
    const supabase = createClient();
    const base = randomBase();
    const videoPath = `places/${placeId}/${base}.mp4`;

    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(videoPath, file, {
        contentType: "video/mp4",
        upsert: true,
        cacheControl: "31536000",
      });
    if (error) throw error;
    const videoUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(videoPath).data.publicUrl;

    // Poster frame + duration, extracted client-side.
    const objectUrl = URL.createObjectURL(file);
    try {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.src = objectUrl;
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("video load failed"));
      });
      video.currentTime = Math.min(0.5, video.duration / 2);
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });

      const scale = Math.min(1, 800 / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
      const poster = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.8)
      );

      let posterUrl: string | null = null;
      if (poster) {
        const posterPath = `places/${placeId}/${base}-poster-800.jpg`;
        const { error: posterError } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(posterPath, poster, {
            contentType: "image/jpeg",
            upsert: true,
            cacheControl: "31536000",
          });
        if (!posterError) {
          posterUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(posterPath).data.publicUrl;
        }
      }

      const result = await saveMediaRowAction(
        {
          place_id: placeId,
          type: "video",
          provider: "storage",
          url: videoUrl,
          thumb_url: posterUrl,
          width: canvas.width,
          height: canvas.height,
          duration_seconds: Number.isFinite(video.duration)
            ? Math.round(video.duration)
            : null,
          sort_order: sortCounter.current++,
        },
        placeSlug
      );
      if (!result.ok) throw new Error(result.error);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function processItem(item: Item) {
    try {
      setStatus(item.key, "uploading");
      if (item.file.type.startsWith("video/")) {
        await uploadVideo(item.file);
      } else {
        await uploadPhoto(item.file);
      }
      setStatus(item.key, "done");
      router.refresh();
    } catch {
      setStatus(item.key, "failed");
    }
  }

  function addFiles(files: FileList | File[]) {
    const accepted = [...files].filter(
      (f) => f.type.startsWith("image/") || f.type === "video/mp4"
    );
    const newItems: Item[] = accepted.map((file) => ({
      key: `${file.name}-${randomBase()}`,
      name: file.name,
      status: "processing",
      file,
    }));
    setItems((prev) => [...prev, ...newItems]);
    // Sequential to keep memory in check on phones.
    void (async () => {
      for (const item of newItems) await processItem(item);
    })();
  }

  const statusLabel: Record<ItemStatus, (name: string) => string> = {
    processing: (name) => t("processing", { name }),
    uploading: (name) => t("uploading", { name }),
    done: (name) => t("done", { name }),
    failed: (name) => t("failed", { name }),
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        className="rounded-2xl border-2 border-dashed border-basalt/30 bg-surface p-6 text-center"
      >
        <p className="mb-4 text-muted">{t("dropHint")}</p>
        <label className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-lg font-semibold text-surface">
          <ImagePlus aria-hidden="true" className="h-6 w-6" />
          {t("upload")}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/mp4"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {items.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-basalt/10 bg-surface p-3"
            >
              <span className="min-w-0 flex-1 truncate ltr-nums text-base">
                {statusLabel[item.status](item.name)}
              </span>
              {item.status === "failed" && (
                <button
                  type="button"
                  onClick={() => void processItem(item)}
                  className="flex min-h-12 items-center rounded-xl border-[1.5px] border-basalt/30 bg-surface px-4 font-medium"
                >
                  {t("retry")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}