import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card-elevated flex flex-col items-center gap-6 p-8 text-center">
        <h1 className="text-3xl">{t("notFoundTitle")}</h1>
        <p className="text-lg text-muted">{t("notFoundMessage")}</p>
        <Link
          href="/"
          className="press flex min-h-14 items-center justify-center rounded-2xl bg-primary px-8 text-lg font-semibold text-surface"
        >
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}