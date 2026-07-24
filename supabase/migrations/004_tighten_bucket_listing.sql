-- Mirror of the migration applied to the hosted project via MCP on 2026-07-24.
-- Public bucket objects are served via /object/public/ URLs without needing a SELECT
-- policy; the broad policy only enabled listing the whole bucket. Restrict listing to admins.
drop policy "public read media bucket" on storage.objects;
create policy "admin read media bucket" on storage.objects
  for select to authenticated using (bucket_id = 'media' and public.is_admin());
