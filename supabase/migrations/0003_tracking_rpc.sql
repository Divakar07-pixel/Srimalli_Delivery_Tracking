-- Migration 0003: Public tracking RPCs
-- These are the ONLY way anonymous visitors can read order data. Each
-- function is SECURITY DEFINER (bypasses RLS internally) but returns a
-- deliberately narrow, masked shape — never raw table rows.

-- ============================================================
-- search_orders_by_mobile
-- Used for the "multiple orders for same mobile" list view.
-- Returns a lightweight summary only — no address, no items, no invoice file.
-- ============================================================
create or replace function public.search_orders_by_mobile(p_mobile text)
returns table (
  order_id uuid,
  tracking_id text,
  invoice_number text,
  order_date date,
  grand_total numeric,
  status order_status,
  masked_mobile text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mobile text := regexp_replace(p_mobile, '\D', '', 'g');
begin
  if length(v_mobile) < 6 then
    return; -- refuse to run overly broad/partial searches
  end if;

  return query
    select
      o.id,
      o.tracking_id,
      o.invoice_number,
      o.order_date,
      o.grand_total,
      o.status,
      repeat('*', greatest(length(c.mobile) - 4, 0)) || right(c.mobile, 4)
    from public.orders o
    join public.customers c on c.id = o.customer_id
    where regexp_replace(c.mobile, '\D', '', 'g') = right(v_mobile, 10)
    order by o.order_date desc;
end;
$$;

revoke all on function public.search_orders_by_mobile(text) from public;
grant execute on function public.search_orders_by_mobile(text) to anon, authenticated;

-- ============================================================
-- get_order_tracking
-- Full detail for ONE order, looked up by tracking_id OR invoice_number.
-- This requires the caller to already know a specific, non-guessable
-- reference (tracking_id) or the exact invoice number — not just a mobile
-- digit string — so it's safe to return fuller detail here.
-- Customer address is intentionally still excluded from public output.
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

revoke all on function public.get_order_tracking(text) from public;
grant execute on function public.get_order_tracking(text) to anon, authenticated;

-- ============================================================
-- get_public_settings
-- Only the fields the public landing page is allowed to see.
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
    'business_address', business_address
  )
  from public.settings
  where id = 1;
$$;

revoke all on function public.get_public_settings() from public;
grant execute on function public.get_public_settings() to anon, authenticated;
