import { setRequestLocale } from "next-intl/server";
import { MapView, mapMetadata } from "@/views/map";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("en");
  return mapMetadata("en");
}

export default function MapPage() {
  setRequestLocale("en");
  return <MapView lang="en" />;
}
