import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { CoverImage } from "@/lib/content";
import type { PlaceCategory } from "@/lib/maps";
import { PlaceImage, PlaceholderImage } from "@/components/place/PlaceImage";
import { TelegramIconLink } from "@/components/layout/TelegramIconLink";

/**
 * Compact photo-led page header — the place-page hero's little sibling
 * (~30dvh vs 62dvh). Photography carries the page identity; a bottom
 * `hero-melt` fade dissolves the image into the body's sand gradient (which
 * has fully settled to sand by 28vh, so the seam is invisible). Content sits
 * on the ≥0.82-alpha band of scrim-hero: pb-14 keeps it clear of the h-12
 * melt, pt-20 clears the floating أ control.
 */
export async function PageHero({
  photo,
  category = "mosque",
  title,
  subtitle,
  children,
  innerClassName = "max-w-3xl",
}: {
  photo: CoverImage | null;
  category?: PlaceCategory;
  title: string;
  subtitle?: string | null;
  children?: ReactNode;
  innerClassName?: string;
}) {
  const t = await getTranslations("common");

  return (
    <header className="relative min-h-[30dvh] overflow-hidden bg-basalt md:min-h-[34dvh]">
      {photo ? (
        <PlaceImage
          media={photo}
          alt=""
          sizes="100vw"
          priority
          capMobile
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <PlaceholderImage
          category={category}
          className="absolute inset-0 h-full w-full"
          iconClassName="h-20 w-20"
        />
      )}
      <div aria-hidden="true" className="warm-wash absolute inset-0" />
      <div aria-hidden="true" className="scrim-hero absolute inset-0" />
      <div aria-hidden="true" className="hero-melt absolute inset-x-0 bottom-0 h-12" />

      {/* Mirrors the floating أ control across the header; pt-20 below already
          reserves this band, so it never crowds the title. */}
      <TelegramIconLink className="absolute end-2 top-[max(env(safe-area-inset-top),0.5rem)] z-10" />

      <div className="relative flex min-h-[30dvh] flex-col justify-end px-4 pb-14 pt-20 md:min-h-[34dvh]">
        <div className={`mx-auto w-full space-y-2 ${innerClassName}`}>
          <p className="font-wordmark text-lg text-accent">{t("siteName")}</p>
          <h1 className="text-4xl leading-tight text-paper">{title}</h1>
          <span aria-hidden="true" className="gold-rule block h-px w-20" />
          {subtitle && (
            <p className="max-w-2xl text-lg leading-relaxed text-paper/85">{subtitle}</p>
          )}
          {children}
        </div>
      </div>
    </header>
  );
}
