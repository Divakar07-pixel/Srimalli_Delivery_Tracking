-- Migration 0002: Row Level Security
-- Admin (authenticated users) get full access to all tables.
-- Anonymous/public users get NO direct table access — all customer-facing
-- tracking goes through the security-definer RPC functions in 0003_tracking_rpc.sql,
-- which return only curated, masked fields.

alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.order_status_history enable row level security;
alter table public.settings enable row level security;

-- ---- customers ----
drop policy if exists "admin_full_access_customers" on public.customers;
create policy "admin_full_access_customers"
  on public.customers
  for all
  to authenticated
  using (true)
  with check (true);

-- ---- orders ----
drop policy if exists "admin_full_access_orders" on public.orders;
create policy "admin_full_access_orders"
  on public.orders
  for all
  to authenticated
  using (true)
  with check (true);

-- ---- order_items ----
drop policy if exists "admin_full_access_order_items" on public.order_items;
create policy "admin_full_access_order_items"
  on public.order_items
  for all
  to authenticated
  using (true)
  with check (true);

-- ---- invoices ----
drop policy if exists "admin_full_access_invoices" on public.invoices;
create policy "admin_full_access_invoices"
  on public.invoices
  for all
  to authenticated
  using (true)
  with check (true);

-- ---- order_status_history ----
drop policy if exists "admin_full_access_status_history" on public.order_status_history;
create policy "admin_full_access_status_history"
  on public.order_status_history
  for all
  to authenticated
  using (true)
  with check (true);

-- ---- settings ----
drop policy if exists "admin_full_access_settings" on public.settings;
create policy "admin_full_access_settings"
  on public.settings
  for all
  to authenticated
  using (true)
  with check (true);

-- No policy is created for the `anon` role on any base table, so with RLS
-- enabled anon has zero row visibility by default. Public access is exposed
-- exclusively through the RPC functions below (SECURITY DEFINER, tightly scoped).
