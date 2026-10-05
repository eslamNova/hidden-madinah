import { setRequestLocale } from "next-intl/server";
import { StoriesView, storiesMetadata } from "@/views/stories";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("ar");
  return storiesMetadata("ar");
}

export default function StoriesPage() {
  setRequestLocale("ar");
  return <StoriesView lang="ar" />;
}
