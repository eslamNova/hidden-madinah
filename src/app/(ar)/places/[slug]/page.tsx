import { setRequestLocale } from "next-intl/server";
import { PlaceView, placeMetadata, placeStaticParams } from "@/views/place";

export const revalidate = 86400;

export function generateStaticParams() {
  return placeStaticParams();
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  setRequestLocale("ar");
  return placeMetadata("ar", params);
}

export default function PlacePage({ params }: Props) {
  setRequestLocale("ar");
  return <PlaceView lang="ar" params={params} />;
}
