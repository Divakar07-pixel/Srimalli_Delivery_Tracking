-- Srimalli Food Product — Delivery Tracking System
-- Migration 0001: core schema

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUM: delivery status
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum (
      'order_created',
      'supplier_dispatched',
      'arrived_at_hub',
      'out_for_delivery',
      'delivered',
      'cancelled'
    );
  end if;
end $$;

-- ============================================================
-- customers
-- ============================================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customers_mobile on public.customers (mobile);

-- ============================================================
-- orders
-- ============================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tracking_id text not null unique,
  customer_id uuid not null references public.customers (id) on delete restrict,
  invoice_number text not null,
  invoice_date date,
  order_date date not null default current_date,
  expected_delivery_date date,
  status order_status not null default 'order_created',
  grand_total numeric(12, 2) not null default 0,
  notes text,
  delivery_location_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_invoice_number_unique unique (invoice_number)
);

create index if not exists idx_orders_customer_id on public.orders (customer_id);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_orders_tracking_id on public.orders (tracking_id);
create index if not exists idx_orders_invoice_number on public.orders (invoice_number);
create index if not exists idx_orders_order_date on public.orders (order_date desc);

-- ============================================================
-- order_items  (dynamic — no product master table, by design)
-- ============================================================
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_name text not null,
  quantity numeric(12, 3) not null default 1,
  unit text not null default 'pcs',
  price numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order_id on public.order_items (order_id);

-- ============================================================
-- invoices (bill/invoice image or PDF, stored in Supabase Storage)
-- ============================================================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  file_url text,
  file_path text not null,
  file_type text not null,
  original_filename text,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoices_order_id on public.invoices (order_id);

-- ============================================================
-- order_status_history
-- ============================================================
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  previous_status order_status,
  new_status order_status not null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_status_history_order_id on public.order_status_history (order_id);

-- ============================================================
-- settings (single row — company/business configuration)
-- ============================================================
create table if not exists public.settings (
  id int primary key default 1,
  company_name text not null default 'Srimalli Food Product',
  logo_url text,
  business_phone text,
  business_address text,
  whatsapp_template_arrived text,
  whatsapp_template_out_for_delivery text,
  whatsapp_template_delivered text,
  default_expected_delivery_text text default 'within 1-2 days of arrival at hub',
  theme text not null default 'system',
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

insert into public.settings (id, company_name)
values (1, 'Srimalli Food Product')
on conflict (id) do nothing;

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- ============================================================
-- status history auto-log trigger
-- ============================================================
create or replace function public.log_order_status_change()
returns trigger as $$
begin
  if (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    insert into public.order_status_history (order_id, previous_status, new_status)
    values (new.id, old.status, new.status);
  elsif (tg_op = 'INSERT') then
    insert into public.order_status_history (order_id, previous_status, new_status)
    values (new.id, null, new.status);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_status_history on public.orders;
create trigger trg_orders_status_history
  after insert or update on public.orders
  for each row execute function public.log_order_status_change();
