"use client";

import NextLink from "next/link";
import { useLocale } from "next-intl";
import type { ComponentProps } from "react";
import { langOf, localizeHref } from "@/lib/i18n";

/**
 * next/link that keeps visitors in their language: on English pages "/plan"
 * becomes "/en/plan" (pages without an English twin keep their Arabic URL).
 * Components write Arabic paths; the language is applied here.
 */
export default function Link({ href, ...rest }: ComponentProps<typeof NextLink>) {
  const lang = langOf(useLocale());
  return <NextLink href={typeof href === "string" ? localizeHref(href, lang) : href} {...rest} />;
}
