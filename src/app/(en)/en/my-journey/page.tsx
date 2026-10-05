import { setRequestLocale } from "next-intl/server";
import { MyJourneyView, myJourneyMetadata } from "@/views/my-journey";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("en");
  return myJourneyMetadata("en");
}

export default function MyJourneyPage() {
  setRequestLocale("en");
  return <MyJourneyView lang="en" />;
}
