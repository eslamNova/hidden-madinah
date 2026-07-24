-- Mirror of the migration applied to the hosted project via MCP on 2026-07-24.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array['image/webp','image/jpeg','video/mp4'])
on conflict (id) do nothing;

create policy "public read media bucket" on storage.objects
  for select using (bucket_id = 'media');
create policy "admin insert media bucket" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy "admin update media bucket" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin()) with check (bucket_id = 'media' and public.is_admin());
create policy "admin delete media bucket" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());
