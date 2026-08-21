import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  // admin_users itself is service-role-only; the rpc answers for the caller.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/admin/login");

  const t = await getTranslations("admin");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-ink/10 pb-4">
        <h1 className="text-2xl">{t("title")}</h1>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex min-h-12 items-center rounded-xl border-[1.5px] border-ink/30 bg-surface px-5 font-medium"
          >
            {t("signOut")}
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}