import { setRequestLocale } from "next-intl/server";
import { StoriesView, storiesMetadata } from "@/views/stories";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("en");
  return storiesMetadata("en");
}

export default function StoriesPage() {
  setRequestLocale("en");
  return <StoriesView lang="en" />;
}
