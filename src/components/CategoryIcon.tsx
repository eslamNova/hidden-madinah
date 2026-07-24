import { Castle, Droplets, Landmark, MapPin, Trees } from "lucide-react";
import { CATEGORY_META, type PlaceCategory } from "@/lib/maps";

const ICONS = {
  landmark: Landmark,
  droplets: Droplets,
  trees: Trees,
  castle: Castle,
  "map-pin": MapPin,
} as const;

/** Category glyph (decorative — pair it with the Arabic category label). */
export function CategoryIcon({
  category,
  className,
}: {
  category: PlaceCategory;
  className?: string;
}) {
  const Icon = ICONS[CATEGORY_META[category].icon];
  return <Icon aria-hidden="true" className={className} />;
}