import type { Metadata, Viewport } from "next";
import { Amiri, Cairo, IBM_Plex_Sans_Arabic } from "next/font/google";
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
  // Wordmark + featured quotes only — ~248kB of woff2 that should not race
  // the hero image on 4G. display:swap covers the late arrival.
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
      className={`${cairo.variable} ${plexArabic.variable} ${amiri.variable}`}
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
