-- Delivery partner details and the most recently shared live location.
alter table public.orders
  add column if not exists delivery_partner_name text,
  add column if not exists delivery_partner_mobile text,
  add column if not exists delivery_partner_latitude double precision,
  add column if not exists delivery_partner_longitude double precision,
  add column if not exists delivery_partner_location_updated_at timestamptz;

-- Customers receive only their own order's partner location via the existing
-- tracking reference; no direct public read access to the orders table is added.
create or replace function public.get_delivery_partner_location(p_reference text)
returns json
language sql
security definer
set search_path = public
stable
as $$
  select json_build_object(
    'name', delivery_partner_name,
    'mobile', delivery_partner_mobile,
    'latitude', delivery_partner_latitude,
    'longitude', delivery_partner_longitude,
    'updated_at', delivery_partner_location_updated_at
  )
  from public.orders
  where (tracking_id = p_reference or invoice_number = p_reference)
    and status = 'out_for_delivery'
  limit 1;
$$;

revoke all on function public.get_delivery_partner_location(text) from public;
grant execute on function public.get_delivery_partner_location(text) to anon, authenticated;
