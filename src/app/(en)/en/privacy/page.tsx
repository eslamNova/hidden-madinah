import { setRequestLocale } from "next-intl/server";
import { PrivacyView, privacyMetadata } from "@/views/privacy";

export async function generateMetadata() {
  setRequestLocale("en");
  return privacyMetadata("en");
}

export default function PrivacyPage() {
  setRequestLocale("en");
  return <PrivacyView lang="en" />;
}
