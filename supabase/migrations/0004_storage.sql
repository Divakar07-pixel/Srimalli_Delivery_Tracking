-- Migration 0004: Storage buckets
-- `invoices`  — PRIVATE. Bill/invoice photos & PDFs. Only admin (authenticated)
--               can read/write directly. Customers get access exclusively via
--               the get-invoice-url Edge Function (short-lived signed URL).
-- `branding`  — PUBLIC. Company logo only — small, non-sensitive, needs to be
--               visible on the public landing page without auth.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 15728640, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/png','image/jpeg','image/svg+xml','image/webp'])
on conflict (id) do nothing;

-- ---- invoices bucket policies ----
drop policy if exists "admin_manage_invoices" on storage.objects;
create policy "admin_manage_invoices"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'invoices')
  with check (bucket_id = 'invoices');

-- No anon policy on `invoices` — direct public access is intentionally blocked.
-- The get-invoice-url Edge Function uses the service role key to mint signed
-- URLs after verifying the caller supplied a valid order reference.

-- ---- branding bucket policies ----
drop policy if exists "public_read_branding" on storage.objects;
create policy "public_read_branding"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'branding');

drop policy if exists "admin_manage_branding" on storage.objects;
create policy "admin_manage_branding"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'branding');

drop policy if exists "admin_update_branding" on storage.objects;
create policy "admin_update_branding"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'branding');

drop policy if exists "admin_delete_branding" on storage.objects;
create policy "admin_delete_branding"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'branding');
