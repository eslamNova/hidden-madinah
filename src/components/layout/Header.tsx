import Link from "next/link";
import { useTranslations } from "next-intl";
import { TextSizeControl } from "@/components/TextSizeControl";

export function Header() {
  const t = useTranslations("common");

  return (
    <header className="sticky top-0 z-40 border-b border-basalt/10 bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex min-h-12 items-center gap-2">
          <span className="font-wordmark text-2xl font-bold text-primary">
            {t("siteName")}
          </span>
        </Link>
        <TextSizeControl />
      </div>
    </header>
  );
}
