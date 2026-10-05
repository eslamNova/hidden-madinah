import { setRequestLocale } from "next-intl/server";
import { HomeView, homeMetadata } from "@/views/home";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("en");
  return homeMetadata("en");
}

export default function HomePage() {
  setRequestLocale("en");
  return <HomeView lang="en" />;
}
