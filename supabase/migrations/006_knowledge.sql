-- 006 — Verified knowledge base, journeys, and anonymous feedback tables.
-- Hackathon build (Oct 2026). Paste into Supabase → SQL editor → Run.
-- Idempotent where cheap (IF NOT EXISTS); safe to run once on the hosted project.

-- ── Enums ──────────────────────────────────────────────────────────────────
do $$ begin
  create type review_status as enum ('pending', 'verified', 'rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  -- Scientific package content levels: A settled facts, B explanation from
  -- approved material, C disputed / needs specialist care, D personal ruling.
  create type content_level as enum ('A', 'B', 'C', 'D');
exception when duplicate_object then null; end $$;
do $$ begin
  create type claim_kind as enum ('fact', 'virtue', 'humane', 'practical');
exception when duplicate_object then null; end $$;

-- ── Sources ────────────────────────────────────────────────────────────────
create table if not exists sources (
  id text primary key,
  title_ar text not null,
  title_en text,
  author_ar text,
  author_en text,
  edition_ar text,
  edition_en text,
  url text,
  notes_ar text
);

insert into sources (id, title_ar, title_en, author_ar, author_en, edition_ar, edition_en, url, notes_ar) values
  ('wafa-dki',
   'وفاء الوفاء بأخبار دار المصطفى', 'Wafa al-Wafa bi-Akhbar Dar al-Mustafa',
   'نور الدين علي بن عبد الله السمهودي (ت 911هـ)', 'Nur al-Din al-Samhudi (d. 911 AH)',
   'دار الكتب العلمية، بيروت، ط1، 1419هـ، 4 مجلدات (نص تراث، الكتاب 23695)',
   'Dar al-Kutub al-''Ilmiyya, Beirut, 1st ed. 1419 AH, 4 vols (Turath book 23695)',
   'https://app.turath.io/book/23695',
   'النص المعتمد للاستخراج. ليست الطبعة المحققة؛ تُقابَل المواضع بطبعة السامرائي قبل النشر.'),
  ('wafa-samarrai',
   'وفاء الوفاء بأخبار دار المصطفى', 'Wafa al-Wafa (critical edition)',
   'السمهودي، تحقيق قاسم السامرائي', 'al-Samhudi, ed. Qasim al-Samarrai',
   'مؤسسة الفرقان للتراث الإسلامي، 5 مجلدات', 'Al-Furqan Foundation, 5 vols',
   null,
   'الطبعة العلمية المحققة؛ تستخدم للمقابلة وتخريج الأحاديث من حواشي المحقق.')
on conflict (id) do nothing;

-- ── Claims: every sentence the product may say about history or religion ──
create table if not exists claims (
  id bigint generated always as identity primary key,
  place_id uuid references places(id) on delete cascade,
  topic text,                       -- for claims not tied to one place, e.g. 'nabawi', 'hijra'
  text_ar text not null,            -- the claim, in plain modern Arabic
  text_en text,                     -- reviewed English translation (M5)
  en_reviewed boolean not null default false,
  source_id text not null references sources(id),
  vol int,                          -- printed volume in that source
  page int,                         -- printed page in that source
  quote_ar text,                    -- short verbatim excerpt supporting the claim
  hadith_ref text,                  -- e.g. 'صحيح البخاري 1193'
  grading text,                     -- e.g. 'صحيح' / 'حسن' / 'ضعيف'
  samarrai_ref text,                -- e.g. 'ج3 ص139' when matched in the critical edition
  needs_samarrai_check boolean not null default true,
  content_level content_level not null default 'A',
  kind claim_kind not null default 'fact',
  themes text[] not null default '{}',   -- mercy, forgiveness, humility, loyalty, neighbourliness, …
  status review_status not null default 'pending',
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists claims_place_status_idx on claims (place_id, status);
create index if not exists claims_topic_status_idx on claims (topic, status);

-- ── Practical fields the planner and stop cards need ──────────────────────
alter table places add column if not exists summary_en text;
alter table places add column if not exists story_en text;
alter table places add column if not exists visit_minutes int;
alter table places add column if not exists has_stairs boolean;
alter table places add column if not exists wheelchair_ok boolean;
alter table places add column if not exists walking_effort text
  check (walking_effort in ('low', 'medium', 'high'));
alter table places add column if not exists opening_hours jsonb;  -- { "daily": [["05:00","22:00"]] } or { "always": true }

-- ── Journeys ───────────────────────────────────────────────────────────────
create table if not exists journeys (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_ar text not null,
  title_en text,
  subtitle_ar text,
  subtitle_en text,
  intro_ar text,
  intro_en text,
  theme_ar text,
  theme_en text,
  duration_min int,
  mode text check (mode in ('walk', 'car', 'mixed')),
  tags text[] not null default '{}',     -- ramadan, hajj, family, first-time, evening
  cover_url text,
  sort_order int not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists journey_stops (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references journeys(id) on delete cascade,
  sort_order int not null default 0,
  place_id uuid references places(id) on delete set null,  -- null = a stop with its own title/coords
  title_ar text,
  title_en text,
  lat numeric,
  lng numeric,
  script_ar text,
  script_en text,
  script_kids_ar text,
  human_moment_ar text,
  human_moment_en text,
  reflection_ar text,
  reflection_en text,
  claim_ids bigint[] not null default '{}',
  status review_status not null default 'pending'
);
create index if not exists journey_stops_journey_idx on journey_stops (journey_id, sort_order);

-- The same items are asked before and after the journey, so the difference
-- measures what the visitor learned.
create table if not exists quiz_items (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references journeys(id) on delete cascade,
  sort_order int not null default 0,
  question_ar text not null,
  question_en text,
  options_ar text[] not null,
  options_en text[],
  answer_index int not null,
  explanation_claim_id bigint references claims(id) on delete set null,
  status review_status not null default 'pending'
);

-- ── Anonymous, insert-only tables (no IP, no user id) ─────────────────────
create table if not exists guide_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  lang text,
  context text,                 -- place or journey-stop slug
  question text,
  answer text,
  cited_claim_ids bigint[] not null default '{}',
  refused boolean not null default false,
  model text,
  input_tokens int,
  output_tokens int,
  cached_tokens int,
  latency_ms int,
  feedback smallint             -- 1 / -1 when the visitor rates the answer
);

create table if not exists quiz_results (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  journey_slug text not null,
  lang text,
  familiarity text,             -- self-declared: new / some / good (never religion)
  pre_score int,
  post_score int,
  total int,
  completed_stops int,
  total_stops int,
  rating_clarity smallint,
  rating_flow smallint
);

create table if not exists testimonials (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  display_name text,
  body text not null,
  lang text,
  journey_slug text,
  consent boolean not null,
  status review_status not null default 'pending'
);

-- Daily-cap helper for the guide: callers learn the count, not the rows.
create or replace function guide_calls_since(since timestamptz) returns bigint
language sql stable security definer
set search_path = public
as $$ select count(*) from guide_logs where created_at >= since; $$;
grant execute on function guide_calls_since(timestamptz) to anon, authenticated;

-- ── Row level security ────────────────────────────────────────────────────
alter table sources enable row level security;
alter table claims enable row level security;
alter table journeys enable row level security;
alter table journey_stops enable row level security;
alter table quiz_items enable row level security;
alter table guide_logs enable row level security;
alter table quiz_results enable row level security;
alter table testimonials enable row level security;

drop policy if exists "public read sources" on sources;
create policy "public read sources" on sources for select using (true);
drop policy if exists "admin write sources" on sources;
create policy "admin write sources" on sources for all to authenticated
  using (is_admin()) with check (is_admin());

-- Visitors only ever see verified claims, and only for published places.
drop policy if exists "public read verified claims" on claims;
create policy "public read verified claims" on claims for select using (
  is_admin() or (
    status = 'verified' and (
      place_id is null
      or exists (select 1 from places p where p.id = place_id and p.is_published)
    )
  )
);
drop policy if exists "admin write claims" on claims;
create policy "admin write claims" on claims for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "public read published journeys" on journeys;
create policy "public read published journeys" on journeys for select using (is_published or is_admin());
drop policy if exists "admin write journeys" on journeys;
create policy "admin write journeys" on journeys for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "public read verified stops" on journey_stops;
create policy "public read verified stops" on journey_stops for select using (
  is_admin() or (
    status = 'verified'
    and exists (select 1 from journeys j where j.id = journey_id and j.is_published)
  )
);
drop policy if exists "admin write stops" on journey_stops;
create policy "admin write stops" on journey_stops for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "public read verified quiz" on quiz_items;
create policy "public read verified quiz" on quiz_items for select using (
  is_admin() or (
    status = 'verified'
    and exists (select 1 from journeys j where j.id = journey_id and j.is_published)
  )
);
drop policy if exists "admin write quiz" on quiz_items;
create policy "admin write quiz" on quiz_items for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "anyone logs guide calls" on guide_logs;
create policy "anyone logs guide calls" on guide_logs for insert to anon, authenticated with check (true);
drop policy if exists "admin reads guide logs" on guide_logs;
create policy "admin reads guide logs" on guide_logs for select to authenticated using (is_admin());

drop policy if exists "anyone submits quiz results" on quiz_results;
create policy "anyone submits quiz results" on quiz_results for insert to anon, authenticated with check (true);
drop policy if exists "admin reads quiz results" on quiz_results;
create policy "admin reads quiz results" on quiz_results for select to authenticated using (is_admin());

drop policy if exists "anyone submits testimonials" on testimonials;
create policy "anyone submits testimonials" on testimonials for insert to anon, authenticated
  with check (consent and status = 'pending');
drop policy if exists "public read approved testimonials" on testimonials;
create policy "public read approved testimonials" on testimonials for select
  using (status = 'verified' or is_admin());
drop policy if exists "admin moderates testimonials" on testimonials;
create policy "admin moderates testimonials" on testimonials for update to authenticated
  using (is_admin()) with check (is_admin());
