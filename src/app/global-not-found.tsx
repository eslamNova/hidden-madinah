import "./globals.css";
import type { Metadata } from "next";
import { fontStepScript } from "@/components/layout/SiteDocument";
import { thmanyahSans } from "@/lib/fonts";

/**
 * 404 for URLs that match neither root layout. Each language's own
 * not-found.tsx handles notFound() inside its pages; this page knows no
 * language, so it speaks both. It applies the visitor's stored theme and
 * text size like every other page, and links onward so it isn't a dead end.
 */
export const metadata: Metadata = { title: "404 — مزارات المدينة · Mazarat Madinah" };

const LINKS: [string, string, string][] = [
  ["/places", "الأماكن", "Places"],
  ["/map", "الخريطة", "Map"],
  ["/journeys", "الرحلات", "Journeys"],
];

export default function GlobalNotFound() {
  return (
    <html lang="ar" dir="rtl" className={thmanyahSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: fontStepScript }} />
      </head>
      <body className="min-h-dvh bg-sand text-ink antialiased">
        <main className="mx-auto max-w-md px-4 py-16">
          <div className="card-elevated flex flex-col items-center gap-6 p-8 text-center">
            <h1 className="text-3xl">الصفحة غير موجودة</h1>
            <p lang="en" dir="ltr" className="text-xl">
              Page not found
            </p>
            {/* Plain anchors: this page sits outside both root layouts. */}
            <div className="flex flex-wrap justify-center gap-3">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="press flex min-h-14 items-center rounded-2xl bg-primary px-8 text-lg font-semibold text-paper">
                الصفحة الرئيسية
              </a>
              <a
                href="/en"
                lang="en"
                className="press flex min-h-14 items-center rounded-2xl border-[1.5px] border-primary px-8 text-lg font-semibold text-brand"
              >
                Home
              </a>
            </div>
            <nav aria-label="روابط" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-lg">
              {LINKS.map(([href, ar, en]) => (
                <span key={href} className="flex gap-2">
                  <a href={href} className="underline underline-offset-4">
                    {ar}
                  </a>
                  <a href={`/en${href}`} lang="en" className="text-muted underline underline-offset-4">
                    {en}
                  </a>
                </span>
              ))}
            </nav>
          </div>
        </main>
      </body>
    </html>
  );
}
