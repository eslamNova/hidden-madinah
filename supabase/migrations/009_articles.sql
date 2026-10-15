-- 009 — Blog articles («المقالات»), Arabic and English, written and published
-- by the owner in /admin/articles. Paste into Supabase → SQL editor → Run.
-- Safe to re-run (IF NOT EXISTS / DROP … IF EXISTS throughout).
--
-- Visitors (anon) read published articles only; admins (is_admin(), migration
-- 001) read and write everything. Bodies are Markdown; the site renders them
-- on the server with raw HTML escaped and the output sanitised against a tag
-- allowlist (src/lib/markdown.ts, src/lib/article-html.ts).

create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_ar text not null default '',
  title_en text,
  excerpt_ar text,
  excerpt_en text,
  body_ar text not null default '',            -- Markdown
  body_en text,                                -- Markdown; empty → the English page says "not in English yet"
  cover_url text,
  place_slugs text[] not null default '{}',    -- places.slug, in display order
  journey_slugs text[] not null default '{}',  -- journeys.slug
  sources jsonb not null default '[]'::jsonb,  -- [{ "vol": 3, "page": 139, "note": "…" }] — Wafa al-Wafa references
  tags text[] not null default '{}',
  status text not null default 'draft',
  published_at timestamptz,
  author text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_published_idx on articles (published_at desc) where status = 'published';

-- ── Shape and size limits (the anon key is public; keep rows bounded) ──────
-- The admin form enforces the same limits (ARTICLE_LIMITS in
-- src/lib/article-format.ts) so the database never has to refuse a save.
alter table articles drop constraint if exists articles_status;
alter table articles add constraint articles_status check (status in ('draft', 'published'));

alter table articles drop constraint if exists articles_slug_format;
alter table articles add constraint articles_slug_format check (
  slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120
);

alter table articles drop constraint if exists articles_sizes;
alter table articles add constraint articles_sizes check (
  char_length(title_ar) <= 200
  and char_length(coalesce(title_en, '')) <= 200
  and char_length(coalesce(excerpt_ar, '')) <= 600
  and char_length(coalesce(excerpt_en, '')) <= 600
  and char_length(body_ar) <= 100000
  and char_length(coalesce(body_en, '')) <= 100000
  and char_length(coalesce(cover_url, '')) <= 1000
  and char_length(coalesce(author, '')) <= 120
  and cardinality(place_slugs) <= 50
  and cardinality(journey_slugs) <= 20
  and cardinality(tags) <= 20
  and char_length(array_to_string(tags, ',')) <= 800
  and jsonb_typeof(sources) = 'array'
  and jsonb_array_length(sources) <= 100
);

-- Covers are https only (they end up in <img src> and og:image).
alter table articles drop constraint if exists articles_cover_https;
alter table articles add constraint articles_cover_https check (cover_url is null or cover_url ~ '^https://');

-- A published article always has an Arabic title, an Arabic body and a date.
alter table articles drop constraint if exists articles_publishable;
alter table articles add constraint articles_publishable check (
  status <> 'published'
  or (btrim(title_ar) <> '' and btrim(body_ar) <> '' and published_at is not null)
);

-- ── Timestamps: the server's clock ─────────────────────────────────────────
-- updated_at moves on every edit; published_at is stamped the first time an
-- article is published and kept through later unpublish / republish.
create or replace function articles_stamp() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at = now();
  end if;
  new.updated_at = now();
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists articles_stamp on articles;
create trigger articles_stamp before insert or update on articles
  for each row execute function articles_stamp();

-- ── Row level security ────────────────────────────────────────────────────
alter table articles enable row level security;

drop policy if exists "public read published articles" on articles;
create policy "public read published articles" on articles for select
  using (status = 'published' or is_admin());

drop policy if exists "admin write articles" on articles;
create policy "admin write articles" on articles for all to authenticated
  using (is_admin()) with check (is_admin());

-- Visitors only ever read; writes go through the admin's own session.
revoke all on articles from anon;
grant select on articles to anon;
