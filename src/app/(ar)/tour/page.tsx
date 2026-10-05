import { setRequestLocale } from "next-intl/server";
import { TourView, tourMetadata } from "@/views/tour";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("ar");
  return tourMetadata("ar");
}

export default function TourPage() {
  setRequestLocale("ar");
  return <TourView lang="ar" />;
}
