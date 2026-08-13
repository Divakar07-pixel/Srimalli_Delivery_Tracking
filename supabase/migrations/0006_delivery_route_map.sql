-- Migration 0006: Delivery Route Map
-- Adds shop location to settings, and customer coordinates + map link fields
-- to orders so the public tracking page can render a route from the shop to
-- the customer (Zomato-style). Live GPS delivery-person tracking can be layered
-- on top of these later without a major refactor.

-- ============================================================
-- 1) settings: shop location (Srimalli Food Product)
-- ============================================================
alter table public.settings
  add column if not exists shop_latitude double precision,
  add column if not exists shop_longitude double precision;

-- ============================================================
-- 2) orders: customer pinned location + original map link
-- ============================================================
alter table public.orders
  add column if not exists customer_latitude double precision,
  add column if not exists customer_longitude double precision,
  add column if not exists customer_map_link text;

-- ============================================================
-- 3) helper function: extract the @lat,lng pair from a Google Maps URL
--    (also supports plain "lat,lng" input). Returns null if not found.
-- ============================================================
create or replace function public.parse_coords(p_input text)
returns double precision[]
language sql
immutable
as $$
  select
    case
      when p_input is null then null
      when p_input ~ '@(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)' then
        array[
          (regexp_match(p_input, '@(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)'))[1]::double precision,
          (regexp_match(p_input, '@(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)'))[3]::double precision
        ]
      when p_input ~ '^(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)$' then
        array[
          (regexp_match(p_input, '^(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)$'))[1]::double precision,
          (regexp_match(p_input, '^(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)$'))[3]::double precision
        ]
      else null
    end;
$$;

-- ============================================================
-- 4) Update get_public_settings to include shop coords
-- ============================================================
create or replace function public.get_public_settings()
returns json
language sql
security definer
set search_path = public
stable
as $$
  select json_build_object(
    'company_name', company_name,
    'logo_url', logo_url,
    'business_phone', business_phone,
    'business_address', business_address,
    'shop_latitude', shop_latitude,
    'shop_longitude', shop_longitude
  )
  from public.settings
  where id = 1;
$$;

grant execute on function public.get_public_settings() to anon, authenticated;

-- ============================================================
-- 5) Update get_order_tracking to include customer coords/map link
-- ============================================================
create or replace function public.get_order_tracking(p_reference text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_result json;
begin
  select * into v_order
  from public.orders
  where tracking_id = p_reference or invoice_number = p_reference
  limit 1;

  if not found then
    return null;
  end if;

  select json_build_object(
    'order_id', v_order.id,
    'tracking_id', v_order.tracking_id,
    'invoice_number', v_order.invoice_number,
    'invoice_date', v_order.invoice_date,
    'order_date', v_order.order_date,
    'expected_delivery_date', v_order.expected_delivery_date,
    'status', v_order.status,
    'grand_total', v_order.grand_total,
    'customer_name', c.name,
    'masked_mobile', repeat('*', greatest(length(c.mobile) - 4, 0)) || right(c.mobile, 4),
    'delivery_location_url', v_order.delivery_location_url,
    'customer_latitude', v_order.customer_latitude,
    'customer_longitude', v_order.customer_longitude,
    'customer_map_link', v_order.customer_map_link,
    'items', (
      select coalesce(json_agg(json_build_object(
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'unit', oi.unit,
        'price', oi.price,
        'total', oi.total
      ) order by oi.created_at), '[]'::json)
      from public.order_items oi
      where oi.order_id = v_order.id
    ),
    'timeline', (
      select coalesce(json_agg(json_build_object(
        'previous_status', h.previous_status,
        'new_status', h.new_status,
        'changed_at', h.changed_at
      ) order by h.changed_at), '[]'::json)
      from public.order_status_history h
      where h.order_id = v_order.id
    ),
    'has_invoice', exists (select 1 from public.invoices i where i.order_id = v_order.id)
  )
  into v_result
  from public.customers c
  where c.id = v_order.customer_id;

  return v_result;
end;
$$;

grant execute on function public.get_order_tracking(text) to anon, authenticated;

