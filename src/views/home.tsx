import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { coverImage, stripVerify } from "@/lib/content";
import { languageAlternates, type Lang } from "@/lib/i18n";
import {
  getPublishedPlaces,
  getRoutesWithStops,
  type PlaceWithMedia,
} from "@/lib/queries";
import { HERO_IMAGES } from "@/lib/hero-images";
import { CATEGORY_ORDER } from "@/lib/maps";
import {
  StoryLanding,
  type StoryData,
  type StoryFeatured,
} from "@/components/home/StoryLanding";
import type { StoryPhoto } from "@/components/home/StoryPanel";

/**
 * / and /en. The route files set the request locale before rendering. The
 * title is the root layout's default (the site name in the page's language).
 */
export async function homeMetadata(lang: Lang): Promise<Metadata> {
  return { alternates: languageAlternates("/", lang) };
}

export async function HomeView({ lang }: { lang: Lang }) {
  const tTour = await getTranslations("tour");
  const places = await getPublishedPlaces(lang);
  const routes = await getRoutesWithStops(lang);

  const featured = places.filter((p) => p.featured);

  // Full-bleed panels never repeat an image: each pick marks its URL used.
  const usedPhotoUrls = new Set<string>();
  const takePhoto = (place: PlaceWithMedia | undefined): StoryPhoto => {
    if (!place) return null;
    const unused = place.media.filter((m) => !usedPhotoUrls.has(m.url));
    // coverImage prefers a real photo and falls back to a video poster, so a
    // video-only place still gets a full-bleed panel rather than placeholder art.
    const photo = coverImage(unused);
    if (!photo) return null;
    const source = unused.find((m) => (m.thumb_url ?? m.url) === photo.url);
    usedPhotoUrls.add(source?.url ?? photo.url);
    return photo;
  };

  // Opening and closing panels are the owner's selected المسجد النبوي photos
  // (static assets — the Prophet's Mosque is the app's anchor, deliberately
  // NOT a place row, so it never appears in /places, /map or counts). The
  // pick rotates daily with the page's 24h revalidate.
  const day = Math.floor(Date.now() / 86_400_000);
  const heroImage = HERO_IMAGES[day % HERO_IMAGES.length] ?? null;
  const closingImage =
    HERO_IMAGES.length > 1
      ? HERO_IMAGES[(day + 1) % HERO_IMAGES.length]
      : heroImage;

  const hero = {
    slug: "al-masjid-al-nabawi",
    // Same name the tour's opening chapter uses, in the page's language.
    name_ar: tTour("nabawiName"),
    category: "mosque" as const,
    photo: heroImage,
  };

  // Story panels prefer places that can actually show a photo — featured
  // first, then the rest by the query's featured/distance order. Photo-less
  // featured places only fill panels when there aren't three with photos, so
  // full-bleed placeholder art is a last resort, and a featured place
  // reclaims its panel as soon as it gets photos.
  const toPanel = (p: PlaceWithMedia, photo: StoryPhoto): StoryFeatured => ({
    slug: p.slug,
    name_ar: p.name_ar,
    category: p.category,
    tagline: stripVerify(p.summary_ar),
    photo,
  });
  // The hero is the static Nabawi image, so every featured place (قباء
  // included) is a panel candidate.
  const panelCandidates = [...featured, ...places.filter((p) => !p.featured)];
  const featuredPanels: StoryFeatured[] = [];
  for (const p of panelCandidates) {
    if (featuredPanels.length >= 3) break;
    const photo = takePhoto(p);
    if (photo) featuredPanels.push(toPanel(p, photo));
  }
  for (const p of featured) {
    if (featuredPanels.length >= 3) break;
    if (!featuredPanels.some((x) => x.slug === p.slug)) {
      featuredPanels.push(toPanel(p, null));
    }
  }

  // Farewell panel: a second Nabawi frame bookends the story.
  const closingPhoto: StoryPhoto = closingImage;

  const data: StoryData = {
    hero,
    featured: featuredPanels,
    categories: CATEGORY_ORDER.filter((c) => c !== "other").map((category) => {
      // Representative thumbnail per category (variantUrl handles the rest).
      const photo = coverImage(
        places.filter((p) => p.category === category).flatMap((p) => p.media)
      );
      return {
        category,
        count: places.filter((p) => p.category === category).length,
        photo,
      };
    }),
    routes: routes.slice(0, 2).map((r) => ({
      id: r.id,
      slug: r.slug,
      title_ar: r.title_ar,
      stopsCount: r.stops.length,
      photo: coverImage(r.stops.flatMap((s) => s.media)),
    })),
    closingPhoto,
  };

  // -mb-28 cancels the layout's pb-28 so the document itself never scrolls:
  // there is no top bar anywhere (the أ control floats), so .story-viewport
  // (100dvh) fills the screen exactly and the only scrolling happens inside
  // the snap container.
  return (
    <div className="-mb-28">
      <StoryLanding data={data} />
    </div>
  );
}
