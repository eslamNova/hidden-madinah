import { setRequestLocale } from "next-intl/server";
import { JourneyView, journeyMetadata, journeyStaticParams } from "@/views/journey";

export const revalidate = 86400;

export function generateStaticParams() {
  return journeyStaticParams();
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  setRequestLocale("ar");
  return journeyMetadata("ar", params);
}

export default function JourneyPage({ params }: Props) {
  setRequestLocale("ar");
  return <JourneyView lang="ar" params={params} />;
}
