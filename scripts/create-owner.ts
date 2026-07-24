/**
 * create-owner — creates (or finds) the owner account and grants admin access.
 *
 * Usage (run from the repo root):
 *   npx tsx scripts/create-owner.ts --email <email> --password <password>
 *
 * - email:    --email flag, or OWNER_EMAIL env, or the default owner address.
 * - password: --password flag or OWNER_PASSWORD env — REQUIRED, never hardcoded.
 *
 * Idempotent: re-running finds the existing auth user (password unchanged) and
 * re-upserts the admin_users row.
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

dotenv.config({ path: ".env.local", quiet: true });

const DEFAULT_OWNER_EMAIL = "islam.a.i@outlook.com";

function printUsage(): void {
  console.error(
    [
      "",
      "الاستخدام / Usage:",
      "  npx tsx scripts/create-owner.ts --email <email> --password <password>",
      "",
      "يمكن أيضاً ضبط OWNER_EMAIL و OWNER_PASSWORD في .env.local بدل الخيارات.",
      "You can also set OWNER_EMAIL and OWNER_PASSWORD in .env.local instead of flags.",
      "",
    ].join("\n")
  );
}

function parseArgs(argv: string[]): { email: string; password: string } {
  let email: string | undefined;
  let password: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--email") {
      email = argv[++i];
    } else if (arg.startsWith("--email=")) {
      email = arg.slice("--email=".length);
    } else if (arg === "--password") {
      password = argv[++i];
    } else if (arg.startsWith("--password=")) {
      password = arg.slice("--password=".length);
    } else {
      console.error(`خيار غير معروف / Unknown option: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }

  email = email?.trim() || process.env.OWNER_EMAIL?.trim() || DEFAULT_OWNER_EMAIL;
  password = password || process.env.OWNER_PASSWORD;

  if (!email.includes("@")) {
    console.error(`خطأ: بريد إلكتروني غير صالح / Error: invalid email: ${email}`);
    process.exit(1);
  }
  if (!password) {
    console.error(
      [
        "خطأ: كلمة المرور مطلوبة — مرّرها عبر --password أو ضعها في OWNER_PASSWORD داخل .env.local.",
        "Error: a password is required — pass it via --password or set OWNER_PASSWORD in .env.local.",
      ].join("\n")
    );
    printUsage();
    process.exit(1);
  }
  if (password.length < 8) {
    console.error(
      "خطأ: كلمة المرور قصيرة جداً (8 أحرف على الأقل). / Error: password too short (minimum 8 characters)."
    );
    process.exit(1);
  }

  return { email, password };
}

function requireEnv(): { url: string; serviceKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    console.error(
      [
        "خطأ: NEXT_PUBLIC_SUPABASE_URL غير موجود في ملف .env.local.",
        "Error: NEXT_PUBLIC_SUPABASE_URL is missing/empty in .env.local.",
      ].join("\n")
    );
    process.exit(1);
  }
  if (!serviceKey) {
    console.error(
      [
        "خطأ: SUPABASE_SERVICE_ROLE_KEY غير موجود أو فارغ في ملف .env.local.",
        "انسخه من لوحة تحكم Supabase: Project Settings ← API keys (مفتاح service_role) ثم ألصقه في .env.local.",
        "",
        "Error: SUPABASE_SERVICE_ROLE_KEY is missing/empty in .env.local.",
        "Copy it from the Supabase Dashboard: Project Settings -> API keys (service_role key) and paste it into .env.local.",
      ].join("\n")
    );
    process.exit(1);
  }
  return { url, serviceKey };
}

async function main(): Promise<void> {
  const { email, password } = parseArgs(process.argv.slice(2));
  const { url, serviceKey } = requireEnv();

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });

  // 1. Find an existing auth user with this email (case-insensitive).
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    console.error(`خطأ في قراءة المستخدمين / Failed to list users: ${listError.message}`);
    process.exit(1);
  }

  const existing = listData.users.find(
    (u) => (u.email ?? "").toLowerCase() === email.toLowerCase()
  );

  let userId: string;
  if (existing) {
    userId = existing.id;
    console.log(
      [
        `المستخدم موجود بالفعل / User already exists: ${email}`,
        "لم تُغيَّر كلمة المرور الحالية. / The existing password was NOT changed.",
        "(لإعادة تعيينها استخدم لوحة تحكم Supabase: Authentication ← Users. / To reset it, use the Supabase Dashboard: Authentication -> Users.)",
      ].join("\n")
    );
  } else {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) {
      console.error(
        `خطأ في إنشاء المستخدم / Failed to create user: ${createError?.message ?? "unknown error"}`
      );
      process.exit(1);
    }
    userId = created.user.id;
    console.log(`تم إنشاء المستخدم / User created: ${email}`);
  }

  // 2. Grant admin access (service client bypasses RLS). Idempotent upsert.
  const { error: adminError } = await supabase
    .from("admin_users")
    .upsert({ user_id: userId }, { onConflict: "user_id" });
  if (adminError) {
    console.error(`خطأ في منح صلاحية الإدارة / Failed to grant admin access: ${adminError.message}`);
    process.exit(1);
  }

  console.log(
    [
      "",
      "تم منح صلاحية الإدارة بنجاح. / Admin access granted successfully.",
      `يمكنك الآن تسجيل الدخول من صفحة /admin/login بالبريد: ${email}`,
      `You can now sign in at /admin/login with: ${email}`,
    ].join("\n")
  );
}

main().catch((err) => {
  console.error("خطأ غير متوقع / Unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
