import "../globals.css";
import { setRequestLocale } from "next-intl/server";
import { SiteDocument, rootMetadata, rootViewport } from "@/components/layout/SiteDocument";

/** Root layout for the English site (/en/*). */
export const metadata = rootMetadata("en");
export const viewport = rootViewport;

export default function EnglishRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  setRequestLocale("en");
  return <SiteDocument lang="en">{children}</SiteDocument>;
}
