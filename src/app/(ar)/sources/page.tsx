import { setRequestLocale } from "next-intl/server";
import { SourcesView, sourcesMetadata } from "@/views/sources";

export async function generateMetadata() {
  setRequestLocale("ar");
  return sourcesMetadata("ar");
}

export default function SourcesPage() {
  setRequestLocale("ar");
  return <SourcesView lang="ar" />;
}
