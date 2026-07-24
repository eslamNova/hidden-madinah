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

/** Labeled 4-item bottom navigation — primary navigation, no hamburger. */
export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-basalt/10 bg-surface pb-[env(safe-area-inset-bottom)]"
      aria-label={t("home")}
    >
      <ul className="mx-auto flex max-w-5xl">
        {ITEMS.map(({ href, key, Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-sm ${
                  active ? "font-semibold text-primary" : "text-muted"
                }`}
              >
                <Icon aria-hidden="true" className="h-6 w-6" />
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
