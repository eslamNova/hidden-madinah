import { setRequestLocale } from "next-intl/server";
import { PlaceTourView, placeTourMetadata, placeTourStaticParams } from "@/views/place-tour";

export const revalidate = 86400;

export function generateStaticParams() {
  return placeTourStaticParams();
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  setRequestLocale("en");
  return placeTourMetadata("en", params);
}

export default function PlaceTourPage({ params }: Props) {
  setRequestLocale("en");
  return <PlaceTourView lang="en" params={params} />;
}
