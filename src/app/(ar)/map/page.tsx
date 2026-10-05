import { setRequestLocale } from "next-intl/server";
import { MapView, mapMetadata } from "@/views/map";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("ar");
  return mapMetadata("ar");
}

export default function MapPage() {
  setRequestLocale("ar");
  return <MapView lang="ar" />;
}
