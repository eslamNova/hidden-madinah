import { setRequestLocale } from "next-intl/server";
import { JourneysView, journeysMetadata } from "@/views/journeys";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("en");
  return journeysMetadata("en");
}

export default function JourneysPage() {
  setRequestLocale("en");
  return <JourneysView lang="en" />;
}
