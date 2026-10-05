import { setRequestLocale } from "next-intl/server";
import { RouteView, routeMetadata, routeStaticParams } from "@/views/route";

export const revalidate = 86400;

export function generateStaticParams() {
  return routeStaticParams();
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  setRequestLocale("en");
  return routeMetadata("en", params);
}

export default function RouteDetailPage({ params }: Props) {
  setRequestLocale("en");
  return <RouteView lang="en" params={params} />;
}
