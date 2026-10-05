import { setRequestLocale } from "next-intl/server";
import { PlanView, planMetadata } from "@/views/plan";

export const revalidate = 86400;

export async function generateMetadata() {
  setRequestLocale("en");
  return planMetadata("en");
}

export default function PlanPage() {
  setRequestLocale("en");
  return <PlanView lang="en" />;
}
