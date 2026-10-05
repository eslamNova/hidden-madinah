import "./globals.css";
import type { Metadata } from "next";
import { thmanyahSans } from "@/lib/fonts";

/**
 * 404 for URLs that match neither root layout. Each language's own
 * not-found.tsx handles notFound() inside its pages; this page knows no
 * language, so it speaks both.
 */
export const metadata: Metadata = { title: "404 — مزارات المدينة · Mazarat Madinah" };

export default function GlobalNotFound() {
  return (
    <html lang="ar" dir="rtl" className={thmanyahSans.variable} data-theme="dark">
      <body className="min-h-dvh bg-sand text-ink antialiased">
        <main className="mx-auto max-w-md px-4 py-16">
          <div className="card-elevated flex flex-col items-center gap-6 p-8 text-center">
            <h1 className="text-3xl">الصفحة غير موجودة</h1>
            <p lang="en" dir="ltr" className="text-xl">
              Page not found
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {/* Plain anchors: this page sits outside both root layouts. */}
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
          </div>
        </main>
      </body>
    </html>
  );
}
