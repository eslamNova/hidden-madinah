-- Mirror of the migration applied to the hosted project via MCP on 2026-07-24.
create type place_category as enum ('mosque','well','garden','historical_site','other');
create type media_type as enum ('photo','video');
create type media_provider as enum ('storage','youtube','bunny');

create table places (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_ar text not null,
  name_en text,
  category place_category not null default 'other',
  summary_ar text,
  story_ar text,
  distance_from_prophets_mosque_km numeric,
  drive_time_from_haram_min int,
  how_to_get_there_ar text,
  transport_cost_sar numeric, -- legacy single cost; UI reads transport_options
  transport_note_ar text,
  transport_options jsonb,    -- [{ mode_ar, min_sar, max_sar, note_ar? }]
  featured_quote_ar text,
  featured_quote_source_ar text,
  virtue_ar text,
  google_maps_url text,
  related_place_slugs text[] not null default '{}',
  admin_notes_ar text,        -- owner-facing review notes (never rendered publicly)
  lat numeric,
  lng numeric,
  visiting_tips_ar text,
  best_time_ar text,
  open_status_ar text,
  is_published boolean not null default false,
  featured boolean not null default false,
  last_updated timestamptz not null default now()
);

create table media (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  type media_type not null default 'photo',
  provider media_provider not null default 'storage',
  url text not null unique, -- unique => idempotency anchor for the import script
  thumb_url text,           -- 400px variant; doubles as the video poster
  caption_ar text,
  width int,
  height int,
  duration_seconds int,
  sort_order int not null default 0
);

create table routes (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null,
  description_ar text,
  cover_url text
);

create table route_places (
  route_id uuid not null references routes(id) on delete cascade,
  place_id uuid not null references places(id) on delete cascade,
  sort_order int not null default 0,
  primary key (route_id, place_id)
);

create table admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create index places_category_idx on places (category) where is_published;
create index places_featured_idx on places (featured) where is_published;
create index media_place_sort_idx on media (place_id, sort_order);
create index route_places_route_sort_idx on route_places (route_id, sort_order);

create or replace function set_last_updated() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.last_updated = now();
  return new;
end;
$$;

create trigger places_set_last_updated
  before update on places
  for each row execute function set_last_updated();

create or replace function is_admin() returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists(select 1 from admin_users where user_id = (select auth.uid()));
$$;
