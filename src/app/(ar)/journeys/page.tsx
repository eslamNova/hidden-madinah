import { setRequestLocale } from "next-intl/server";
import { JourneysView, journeysMetadata } from "@/views/journeys";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("ar");
  return journeysMetadata("ar");
}

export default function JourneysPage() {
  setRequestLocale("ar");
  return <JourneysView lang="ar" />;
}
