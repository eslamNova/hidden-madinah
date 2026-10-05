import { setRequestLocale } from "next-intl/server";
import { PlacesView, placesMetadata } from "@/views/places";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("ar");
  return placesMetadata("ar");
}

export default function PlacesPage() {
  setRequestLocale("ar");
  return <PlacesView lang="ar" />;
}
