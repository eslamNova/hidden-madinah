"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home, MapPin, Map, Route } from "lucide-react";

const ITEMS = [
  { href: "/", key: "home", Icon: Home },
  { href: "/places", key: "places", Icon: MapPin },
  { href: "/map", key: "map", Icon: Map },
  { href: "/routes", key: "routes", Icon: Route },
] as const;

/**
 * Floating dock navigation: an inset rounded bar with a soft active pill —
 * labels stay visible (elderly-first, never icon-only) and every target is
 * ≥56px. Dark glass over the story landing, light surface everywhere else;
 * no backdrop-blur anywhere (per-frame re-blurs jank mid-range GPUs).
 */
export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const onStory = pathname === "/";

  // The tour is a full-screen immersive stream — no chrome; its X exits.
  if (pathname === "/tour") return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      aria-label={t("home")}
    >
      <ul
        className={`mx-auto flex max-w-md items-stretch gap-1 rounded-[1.75rem] border p-1.5 shadow-lg ${
          onStory
            ? "border-surface/15 bg-basalt/85"
            : "border-basalt/10 bg-surface/95"
        }`}
      >
        {ITEMS.map(({ href, key, Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`press flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-3xl px-1 py-1.5 text-sm transition-colors duration-150 ${
                  onStory
                    ? active
                      ? "bg-surface/15 font-semibold text-surface"
                      : "text-surface/70"
                    : active
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted"
                }`}
              >
                <Icon aria-hidden="true" className="h-6 w-6" />
                <span className="truncate">{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
