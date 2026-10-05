import { setRequestLocale } from "next-intl/server";
import { HomeView, homeMetadata } from "@/views/home";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("ar");
  return homeMetadata("ar");
}

export default function HomePage() {
  setRequestLocale("ar");
  return <HomeView lang="ar" />;
}
