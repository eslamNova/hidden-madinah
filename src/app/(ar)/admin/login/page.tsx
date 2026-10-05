"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const t = useTranslations("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(true);
      setBusy(false);
      return;
    }
    // Full navigation so the protected server layout re-evaluates the session.
    window.location.assign("/admin");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-8 text-3xl">{t("signInTitle")}</h1>
      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="mb-2 block text-base font-semibold">
            {t("email")}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-[52px] w-full rounded-2xl border-[1.5px] border-ink/30 bg-surface px-4 text-lg"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-2 block text-base font-semibold">
            {t("password")}
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-[52px] w-full rounded-2xl border-[1.5px] border-ink/30 bg-surface px-4 text-lg"
          />
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-basalt px-4 py-3 text-paper">
            {t("signInError")}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-primary px-6 text-lg font-semibold text-paper disabled:opacity-60"
        >
          {busy ? t("signingIn") : t("signIn")}
        </button>
      </form>
    </div>
  );
}