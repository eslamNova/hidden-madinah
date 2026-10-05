import { setRequestLocale } from "next-intl/server";
import { NotFoundScreen } from "@/components/layout/NotFoundScreen";

export default function NotFound() {
  setRequestLocale("en");
  return <NotFoundScreen />;
}
