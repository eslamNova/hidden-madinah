import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { hasVerifyFlags } from "@/lib/content";
import { CATEGORY_META } from "@/lib/maps";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPlacesList() {
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const { data: places } = await supabase
    .from("places")
    .select("*")
    .order("last_updated", { ascending: false });

  const dateFmt = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", {
    dateStyle: "medium",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl">{t("placesTitle")}</h2>
        <Link
          href="/admin/places/new"
          className="flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-paper"
        >
          <Plus aria-hidden="true" className="h-5 w-5" />
          {t("addPlace")}
        </Link>
      </div>

      <ul className="space-y-3">
        {(places ?? []).map((p) => (
          <li key={p.id}>
            <Link
              href={`/admin/places/${p.id}`}
              className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-semibold">{p.name_ar}</span>
                <span className="block text-sm text-muted">
                  {CATEGORY_META[p.category].labelAr}
                  {" · "}
                  {dateFmt.format(new Date(p.last_updated))}
                </span>
              </span>
              {hasVerifyFlags(p) && (
                <span className="rounded-full border-[1.5px] border-accent bg-sand px-3 py-1 text-sm font-medium">
                  {t("needsReview")}
                </span>
              )}
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  p.is_published
                    ? "bg-primary/10 text-brand-dark"
                    : "bg-basalt/10 text-muted"
                }`}
              >
                {p.is_published ? t("published") : t("draft")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}