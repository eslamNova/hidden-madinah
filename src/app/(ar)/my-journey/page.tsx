import { setRequestLocale } from "next-intl/server";
import { MyJourneyView, myJourneyMetadata } from "@/views/my-journey";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("ar");
  return myJourneyMetadata("ar");
}

export default function MyJourneyPage() {
  setRequestLocale("ar");
  return <MyJourneyView lang="ar" />;
}
