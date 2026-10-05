"use client";

import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { langOf, stripLang, type Lang } from "@/lib/i18n";

/** The page's language in client components. */
export const useLang = (): Lang => langOf(useLocale());

/** The current path without the /en prefix — compare against Arabic paths ("/", "/places"). */
export const useBarePath = (): string => stripLang(usePathname());
