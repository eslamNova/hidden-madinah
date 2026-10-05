import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConsentSettings } from "@/components/analytics/ConsentSettings";
import { CONTACT_EMAIL, PRIVACY_UPDATED } from "@/lib/constants";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title"), description: t("intro") };
}

/** Bulleted section — the notice is mostly "here is exactly what we store". */
function Section({
  heading,
  body,
  items,
}: {
  heading: string;
  body?: string;
  items?: string[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl">{heading}</h2>
      {body && <p className="text-muted">{body}</p>}
      {items && (
        <ul className="space-y-2 ps-5 text-muted [list-style:disc]">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 pb-8 pt-10">
      <header className="space-y-3">
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="text-lg text-muted">{t("intro")}</p>
        <p className="text-sm text-muted-decorative">
          {t("updated", { date: PRIVACY_UPDATED })}
        </p>
      </header>

      <Section
        heading={t("collectTitle")}
        body={t("collectBody")}
        items={t.raw("collectItems") as string[]}
      />

      <Section
        heading={t("neverTitle")}
        body={t("neverBody")}
        items={t.raw("neverItems") as string[]}
      />

      <Section heading={t("toolsTitle")} items={t.raw("toolsItems") as string[]} />

      <Section heading={t("locationTitle")} body={t("locationBody")} />

      <Section heading={t("hostingTitle")} body={t("hostingBody")} />

      <section className="space-y-3">
        <h2 className="text-xl">{t("controlTitle")}</h2>
        <p className="text-muted">{t("controlBody")}</p>
        <ConsentSettings />
      </section>

      {CONTACT_EMAIL && (
        <section className="space-y-3">
          <h2 className="text-xl">{t("contactTitle")}</h2>
          <p className="text-muted">
            {t("contactBody")}{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-brand underline underline-offset-4 ltr-nums"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>
      )}
    </div>
  );
}
