import { setRequestLocale } from "next-intl/server";
import { SourcesView, sourcesMetadata } from "@/views/sources";

export async function generateMetadata() {
  setRequestLocale("en");
  return sourcesMetadata("en");
}

export default function SourcesPage() {
  setRequestLocale("en");
  return <SourcesView lang="en" />;
}
