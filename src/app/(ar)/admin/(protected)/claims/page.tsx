import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/database.types";
import { ClaimReviewList, type ReviewClaim } from "@/components/admin/ClaimReviewList";

const STATUSES: Enums<"review_status">[] = ["pending", "verified", "rejected"];

export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ place?: string; status?: string }>;
}) {
  const t = await getTranslations("admin.claims");
  const sp = await searchParams;
  const status = (STATUSES as string[]).includes(sp.status ?? "")
    ? (sp.status as Enums<"review_status">)
    : "pending";
  const supabase = await createClient();

  const [{ data: places }, { data: counts }] = await Promise.all([
    supabase.from("places").select("id, slug, name_ar").order("name_ar"),
    supabase.from("claims").select("place_id, topic, status"),
  ]);

  // Per-place pending/verified tallies for the filter chips.
  const tally = new Map<string, { pending: number; verified: number }>();
  for (const c of counts ?? []) {
    const key = c.place_id ?? `topic:${c.topic ?? "general"}`;
    const row = tally.get(key) ?? { pending: 0, verified: 0 };
    if (c.status === "pending") row.pending++;
    if (c.status === "verified") row.verified++;
    tally.set(key, row);
  }
  const placeById = new Map((places ?? []).map((p) => [p.id, p]));
  const filters = [...tally.entries()].map(([key, n]) => {
    const place = placeById.get(key);
    return {
      key: place ? place.slug : key,
      label: place ? place.name_ar : t("topic", { topic: key.replace("topic:", "") }),
      ...n,
    };
  });

  const selected = sp.place ?? filters[0]?.key;
  let query = supabase
    .from("claims")
    .select("*")
    .eq("status", status)
    .order("vol")
    .order("page")
    .order("id");
  const selectedPlace = (places ?? []).find((p) => p.slug === selected);
  if (selectedPlace) query = query.eq("place_id", selectedPlace.id);
  else if (selected?.startsWith("topic:")) query = query.is("place_id", null).eq("topic", selected.slice(6));
  const { data: claims } = await query.limit(200);

  const href = (place: string | undefined, st: string) =>
    `/admin/claims?${new URLSearchParams({ ...(place ? { place } : {}), status: st })}`;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl">{t("title")}</h2>
        <p className="text-muted">{t("intro")}</p>
      </div>

      {filters.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-surface p-4">{t("empty")}</p>
      ) : (
        <>
          <nav aria-label={t("placesNav")} className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <Link
                key={f.key}
                href={href(f.key, status)}
                aria-current={f.key === selected ? "page" : undefined}
                className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium ${
                  f.key === selected ? "border-primary bg-primary text-paper" : "border-ink/15 bg-surface"
                }`}
              >
                {f.label}{" "}
                <span className="ltr-nums opacity-80">
                  ({f.verified}/{f.pending + f.verified})
                </span>
              </Link>
            ))}
          </nav>

          <nav aria-label={t("statusNav")} className="flex gap-2">
            {STATUSES.map((st) => (
              <Link
                key={st}
                href={href(selected, st)}
                aria-current={st === status ? "page" : undefined}
                className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${
                  st === status ? "bg-basalt text-paper" : "bg-surface"
                }`}
              >
                {t(`status.${st}`)}
              </Link>
            ))}
          </nav>

          <ClaimReviewList claims={(claims ?? []) as ReviewClaim[]} status={status} />
        </>
      )}
    </div>
  );
}
