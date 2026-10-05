import { setRequestLocale } from "next-intl/server";
import { RoutesView, routesMetadata } from "@/views/routes";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("en");
  return routesMetadata("en");
}

export default function RoutesPage() {
  setRequestLocale("en");
  return <RoutesView lang="en" />;
}
