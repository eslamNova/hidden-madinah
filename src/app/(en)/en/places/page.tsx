import { setRequestLocale } from "next-intl/server";
import { PlacesView, placesMetadata } from "@/views/places";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("en");
  return placesMetadata("en");
}

export default function PlacesPage() {
  setRequestLocale("en");
  return <PlacesView lang="en" />;
}
