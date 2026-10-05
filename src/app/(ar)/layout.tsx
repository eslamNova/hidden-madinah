import "../globals.css";
import { setRequestLocale } from "next-intl/server";
import { SiteDocument, rootMetadata, rootViewport } from "@/components/layout/SiteDocument";

/** Root layout for the Arabic site (every URL outside /en). */
export const metadata = rootMetadata("ar");
export const viewport = rootViewport;

export default function ArabicRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  setRequestLocale("ar");
  return <SiteDocument lang="ar">{children}</SiteDocument>;
}
