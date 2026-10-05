import { setRequestLocale } from "next-intl/server";
import { PlanView, planMetadata } from "@/views/plan";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("ar");
  return planMetadata("ar");
}

export default function PlanPage() {
  setRequestLocale("ar");
  return <PlanView lang="ar" />;
}
