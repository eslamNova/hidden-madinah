import { setRequestLocale } from "next-intl/server";
import { RoutesView, routesMetadata } from "@/views/routes";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("ar");
  return routesMetadata("ar");
}

export default function RoutesPage() {
  setRequestLocale("ar");
  return <RoutesView lang="ar" />;
}
