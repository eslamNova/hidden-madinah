import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
import { SiteAnalytics } from "@/components/analytics/SiteAnalytics";
import { FloatingTextSize } from "@/components/layout/FloatingTextSize";
import { ImmersiveBody } from "@/components/layout/ImmersiveBody";
import { BottomNav } from "@/components/layout/BottomNav";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { siteDescription, siteName, siteUrl } from "@/lib/constants";
import { thmanyahSans, thmanyahSerif } from "@/lib/fonts";
import type { Lang } from "@/lib/i18n";

/**
 * The <html> document both root layouts share (src/app/(ar)/layout.tsx and
 * src/app/(en)/layout.tsx). Each language has its own root layout so lang
 * and dir are correct in the server HTML and every page stays static.
 */

// Share previews (WhatsApp, iMessage, X, Facebook) read these. Child pages
// that only set `title` inherit the image; place pages supply their own.
export function rootMetadata(lang: Lang): Metadata {
  const name = siteName(lang);
  const description = siteDescription(lang);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: name, template: `%s | ${name}` },
    description,
    applicationName: name,
    openGraph: {
      siteName: name,
      title: name,
      description,
      locale: lang === "ar" ? "ar_SA" : "en_US",
      alternateLocale: lang === "ar" ? "en_US" : "ar_SA",
      type: "website",
      images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: name, type: "image/jpeg" }],
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
      images: ["/og-image.jpg"],
    },
  };
}

// Zoom must never be disabled (elderly-first): no maximumScale / userScalable.
// viewport-fit=cover lets full-bleed screens (landing, tours) extend under the
// iPhone notch and home bar instead of Safari painting those bands sand.
export const rootViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f5c3d",
};

// Applies the persisted font step and theme before first paint (no FOUC).
// Theme: dark is the default. A stored choice still wins on return visits;
// the OS prefers-color-scheme is deliberately NOT consulted.
const fontStepScript = `try{var d=document.documentElement,s=localStorage.getItem("hm-font-step");if(s==="1"||s==="2"){d.dataset.fontStep=s}var t=localStorage.getItem("hm-theme");if(t!=="dark"&&t!=="light"){t="dark"}d.dataset.theme=t}catch(e){}`;

export async function SiteDocument({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  // Admin strings stay out of public pages' RSC payload; the admin layout
  // provides the full message set for /admin/*.
  const allMessages = await getMessages();
  const publicMessages = Object.fromEntries(
    Object.entries(allMessages).filter(([namespace]) => namespace !== "admin")
  );
  const t = await getTranslations("common");

  return (
    <html
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      // data-font-step / data-theme are set pre-paint by the inline script.
      suppressHydrationWarning
      className={`${thmanyahSans.variable} ${thmanyahSerif.variable}`}
    >
      {/* This component IS the root layout's document (both root layouts render it). */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: fontStepScript }} />
      </head>
      <body className="min-h-dvh bg-sand text-ink antialiased">
        <NextIntlClientProvider messages={publicMessages}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:text-paper"
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
