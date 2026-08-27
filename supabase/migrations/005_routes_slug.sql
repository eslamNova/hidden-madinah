-- Routes get URL slugs: shared links read /routes/quba-wells instead of a
-- raw UUID. Old UUID links keep working — the page 308-redirects id → slug.
-- (Applied to the hosted project on 2026-08-27 as migration `routes_slug`.)
alter table public.routes add column slug text;

update public.routes set slug = 'quba-wells' where id = '11111111-1111-4111-8111-111111111111';
-- Any route without a curated slug falls back to its id so NOT NULL can land.
update public.routes set slug = id::text where slug is null;

alter table public.routes alter column slug set not null;
alter table public.routes add constraint routes_slug_key unique (slug);
