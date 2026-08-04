-- READ-ONLY POST-DEPLOYMENT VERIFICATION
-- Run in Supabase SQL Editor after applying migrations. Every query below is
-- read-only and should return the expected rows described in its comment.

-- Expected: profiles, customers, orders, order_items, invoices,
-- order_status_history, settings -- all with RLS enabled.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'customers', 'orders', 'order_items', 'invoices', 'order_status_history', 'settings')
order by c.relname;

-- Expected: FK cascade for profiles -> auth.users and order children; orders
-- deliberately restricts customer deletion so existing delivery history is not orphaned.
select conrelid::regclass as table_name,
       conname as constraint_name,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where contype in ('p', 'f', 'u', 'c')
  and conrelid::regclass::text in (
    'public.profiles', 'public.customers', 'public.orders', 'public.order_items',
    'public.invoices', 'public.order_status_history', 'public.settings'
  )
order by table_name, constraint_name;

-- Expected: primary/unique indexes plus order lookup indexes, including
-- tracking_id, invoice_number, status, order_date, customer_id, and child FKs.
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('profiles', 'customers', 'orders', 'order_items', 'invoices', 'order_status_history', 'settings')
order by tablename, indexname;

-- Expected: only admin role policies on admin data; no anonymous write policy.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
  and (tablename in ('profiles', 'customers', 'orders', 'order_items', 'invoices', 'order_status_history', 'settings')
       or (schemaname = 'storage' and tablename = 'objects'))
order by schemaname, tablename, policyname;

-- Expected: invoices is private and accepts the configured bill formats;
-- branding is public for the company logo.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('invoices', 'branding')
order by id;
