import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SiteAnalytics } from "@/components/analytics/SiteAnalytics";
import { FloatingTextSize } from "@/components/layout/FloatingTextSize";
import { ImmersiveBody } from "@/components/layout/ImmersiveBody";
import { BottomNav } from "@/components/layout/BottomNav";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/constants";

// Thmanyah typeface, self-hosted with written permission from thmanyah
// Publishing & Distribution (Khalid, 2026-09-08): self-hosting on our own
// server/CDN for rendering is licensed; publishing a direct download link or
// allowing hotlinking from other projects is not — see the CORS rule in
// next.config.ts. The files are shipped byte-for-byte: next/font/local does
// not subset local fonts, and the licence forbids modifying them (تعديل /
// تكييف), so no subsetting pass may ever be added here.
//
// One family for headings and body (the old Cairo/IBM Plex pair were both
// sans anyway); the serif display carries the wordmark, as Amiri did.
const thmanyahSans = localFont({
  src: [
    { path: "../fonts/thmanyahsans-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/thmanyahsans-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/thmanyahsans-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-thmanyah-sans",
  display: "swap",
});

const thmanyahSerif = localFont({
  src: [
    {
      path: "../fonts/thmanyahserifdisplay-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-thmanyah-serif",
  display: "swap",
  // Wordmark + featured quotes only — 80kB that should not race the hero
  // image on 4G, exactly as Amiri was treated before it.
  preload: false,
});

// Share previews (WhatsApp, iMessage, X, Facebook) read these. Child pages
// that only set `title` inherit the image; place pages supply their own.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: "ar_SA",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: SITE_NAME,
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/og-image.jpg"],
  },
};

// Zoom must never be disabled (elderly-first): no maximumScale / userScalable.
// viewport-fit=cover lets full-bleed screens (landing, tours) extend under the
// iPhone notch and home bar instead of Safari painting those bands sand.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f5c3d",
};

// Applies the persisted font step and theme before first paint (no FOUC).
// Theme: dark is the default. A stored choice still wins on return visits;
// the OS prefers-color-scheme is deliberately NOT consulted.
const fontStepScript = `try{var d=document.documentElement,s=localStorage.getItem("hm-font-step");if(s==="1"||s==="2"){d.dataset.fontStep=s}var t=localStorage.getItem("hm-theme");if(t!=="dark"&&t!=="light"){t="dark"}d.dataset.theme=t}catch(e){}`;

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
      // data-font-step / data-theme are set pre-paint by the inline script.
      suppressHydrationWarning
      className={`${thmanyahSans.variable} ${thmanyahSerif.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: fontStepScript }} />
      </head>
      <body className="min-h-dvh bg-sand text-ink antialiased">
        <NextIntlClientProvider messages={publicMessages}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:text-paper"
          >
            {t("skipToContent")}
          </a>
          <ImmersiveBody />
          <OfflineBanner />
          <FloatingTextSize />
          <main id="main" className="pb-28">
            {children}
          </main>
          <BottomNav />
          {/* Cookieless, so it needs no consent and runs for everyone. This is
              the count we quote — first-party path, so ad blockers can't
              silently shave it the way they do gtag. */}
          <Analytics />
          {/* GA4 + its notice; both no-ops until NEXT_PUBLIC_GA_ID is set. */}
          <SiteAnalytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
