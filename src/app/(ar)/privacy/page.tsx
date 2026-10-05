import { setRequestLocale } from "next-intl/server";
import { PrivacyView, privacyMetadata } from "@/views/privacy";

export async function generateMetadata() {
  setRequestLocale("ar");
  return privacyMetadata("ar");
}

export default function PrivacyPage() {
  setRequestLocale("ar");
  return <PrivacyView lang="ar" />;
}
