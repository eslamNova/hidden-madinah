"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * gtag.js, hand-rolled rather than pulled from @next/third-parties, because the
 * whole point is that the tag mounts ONLY after consent: the component is not
 * rendered before then, so nothing is requested and no cookie is written.
 *
 * `config` sends the entry page_view itself, so the effect below deliberately
 * skips its first run and covers client-side navigations only — otherwise the
 * landing page would be counted twice on every visit.
 *
 * usePathname, never useSearchParams: reading search params this high in the
 * tree opts every page out of static rendering, and public URLs are slug-based
 * (see 4b41305) so the query string holds nothing worth counting.
 */
export function GoogleAnalytics({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const entryView = useRef(true);

  useEffect(() => {
    if (entryView.current) {
      entryView.current = false;
      return;
    }
    window.gtag?.("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
    });
  }, [pathname]);

  return (
    <>
      <Script
        id="ga-src"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
      {/* Queued onto dataLayer, so ordering against the loader above is not a
          race — gtag.js drains whatever is already there when it arrives. */}
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${gaId}',{send_page_view:true});`}
      </Script>
    </>
  );
}
