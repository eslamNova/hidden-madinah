-- Mirror of the migration applied to the hosted project via MCP on 2026-07-24.
alter table places enable row level security;
alter table media enable row level security;
alter table routes enable row level security;
alter table route_places enable row level security;
alter table admin_users enable row level security;

create policy "public read published places" on places
  for select using (is_published or is_admin());

create policy "admin insert places" on places
  for insert to authenticated with check (is_admin());
create policy "admin update places" on places
  for update to authenticated using (is_admin()) with check (is_admin());
create policy "admin delete places" on places
  for delete to authenticated using (is_admin());

create policy "public read media of published places" on media
  for select using (
    is_admin() or exists (select 1 from places p where p.id = place_id and p.is_published)
  );
create policy "admin insert media" on media
  for insert to authenticated with check (is_admin());
create policy "admin update media" on media
  for update to authenticated using (is_admin()) with check (is_admin());
create policy "admin delete media" on media
  for delete to authenticated using (is_admin());

create policy "public read routes" on routes for select using (true);
create policy "admin insert routes" on routes for insert to authenticated with check (is_admin());
create policy "admin update routes" on routes for update to authenticated using (is_admin()) with check (is_admin());
create policy "admin delete routes" on routes for delete to authenticated using (is_admin());

create policy "public read route_places" on route_places for select using (true);
create policy "admin insert route_places" on route_places for insert to authenticated with check (is_admin());
create policy "admin update route_places" on route_places for update to authenticated using (is_admin()) with check (is_admin());
create policy "admin delete route_places" on route_places for delete to authenticated using (is_admin());

-- admin_users: RLS enabled with no policies -> readable/writable via service role only