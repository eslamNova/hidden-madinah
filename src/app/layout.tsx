import type { Metadata, Viewport } from "next";
import { Amiri, Cairo, IBM_Plex_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/constants";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  weight: ["400", "500", "600", "700"],
  subsets: ["arabic", "latin"],
  variable: "--font-plex-arabic",
  display: "swap",
});

const amiri = Amiri({
  weight: ["400", "700"],
  subsets: ["arabic", "latin"],
  variable: "--font-amiri",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    locale: "ar_SA",
    type: "website",
  },
};

// Zoom must never be disabled (elderly-first): no maximumScale / userScalable.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f5c3d",
};

// Applies the persisted font step before first paint (no FOUC).
const fontStepScript = `try{var s=localStorage.getItem("hm-font-step");if(s==="1"||s==="2"){document.documentElement.dataset.fontStep=s}}catch(e){}`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Admin strings stay out of public pages' RSC payload; the admin layout
  // provides the full message set for /admin/*.
  const allMessages = await getMessages();
  const publicMessages = Object.fromEntries(
    Object.entries(allMessages).filter(([namespace]) => namespace !== "admin")
  );
  const t = await getTranslations("common");

  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${plexArabic.variable} ${amiri.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: fontStepScript }} />
      </head>
      <body className="min-h-dvh bg-sand text-basalt antialiased">
        <NextIntlClientProvider messages={publicMessages}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:text-surface"
          >
            {t("skipToContent")}
          </a>
          <OfflineBanner />
          <Header />
          <main id="main" className="pb-28">
            {children}
          </main>
          <BottomNav />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
