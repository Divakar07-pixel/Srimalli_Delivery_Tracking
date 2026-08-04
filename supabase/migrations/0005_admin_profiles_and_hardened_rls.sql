-- Migration 0005: admin profiles and role-based access control
--
-- Existing delivery tables are intentionally preserved. This migration adds
-- the missing auth.users -> profiles relationship and limits all admin data
-- access to users with an explicit admin profile.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null unique,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles (role);

alter table public.profiles enable row level security;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- The function is deliberately argument-free and returns only whether the
-- current user is an administrator. It avoids RLS recursion in policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admin_read_profiles" on public.profiles;
drop policy if exists "admin_manage_profiles" on public.profiles;
create policy "admin_read_profiles"
  on public.profiles for select to authenticated
  using ((select public.is_admin()));
create policy "admin_manage_profiles"
  on public.profiles for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Replace the original authenticated-user-wide policies. Every admin screen
-- now requires both a valid Supabase session and an admin profile.
drop policy if exists "admin_full_access_customers" on public.customers;
drop policy if exists "admin_full_access_orders" on public.orders;
drop policy if exists "admin_full_access_order_items" on public.order_items;
drop policy if exists "admin_full_access_invoices" on public.invoices;
drop policy if exists "admin_full_access_status_history" on public.order_status_history;
drop policy if exists "admin_full_access_settings" on public.settings;

create policy "admin_manage_customers" on public.customers for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_manage_orders" on public.orders for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_manage_order_items" on public.order_items for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_manage_invoices" on public.invoices for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_manage_status_history" on public.order_status_history for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_manage_settings" on public.settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Invoice documents stay private. Authenticated users can access them only
-- when their profile grants the admin role; anonymous users have no writes.
drop policy if exists "admin_manage_invoices" on storage.objects;
create policy "admin_manage_invoice_files"
  on storage.objects for all to authenticated
  using (bucket_id = 'invoices' and (select public.is_admin()))
  with check (bucket_id = 'invoices' and (select public.is_admin()));

-- Branding writes receive the same admin gate. Public logo reads remain safe.
drop policy if exists "admin_manage_branding" on storage.objects;
drop policy if exists "admin_update_branding" on storage.objects;
drop policy if exists "admin_delete_branding" on storage.objects;
create policy "admin_insert_branding"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and (select public.is_admin()));
create policy "admin_update_branding"
  on storage.objects for update to authenticated
  using (bucket_id = 'branding' and (select public.is_admin()))
  with check (bucket_id = 'branding' and (select public.is_admin()));
create policy "admin_delete_branding"
  on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and (select public.is_admin()));
