import { setRequestLocale } from "next-intl/server";
import { TourView, tourMetadata } from "@/views/tour";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("en");
  return tourMetadata("en");
}

export default function TourPage() {
  setRequestLocale("en");
  return <TourView lang="en" />;
}
