-- Migration 0009: single-driver live delivery sessions
-- Exactly one active driver session at a time. Previous orders retain their final location.

alter table public.orders
  add column if not exists delivery_tracking_active boolean not null default false,
  add column if not exists delivery_tracking_started_at timestamptz,
  add column if not exists delivery_tracking_stopped_at timestamptz;

create index if not exists idx_orders_delivery_tracking_active on public.orders (delivery_tracking_active) where delivery_tracking_active = true;

create or replace function public.get_delivery_assignment(p_token uuid)
returns json language sql security definer set search_path = public stable as $$
  select json_build_object(
    'order_id', o.id, 'invoice_number', o.invoice_number, 'customer_name', c.name, 'customer_address', c.address,
    'customer_latitude', o.customer_latitude, 'customer_longitude', o.customer_longitude,
    'status', o.status, 'tracking_active', o.delivery_tracking_active
  )
  from public.orders o join public.customers c on c.id = o.customer_id
  where o.delivery_tracking_token = p_token and o.status in ('out_for_delivery', 'delivered') limit 1;
$$;

create or replace function public.start_delivery_tracking(p_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; v_result json;
begin
  select * into v_order from public.orders where delivery_tracking_token = p_token and status in ('out_for_delivery','delivered') limit 1;
  if not found then raise exception 'This delivery link is invalid or the delivery is no longer active'; end if;

  update public.orders set delivery_tracking_active = false, delivery_tracking_stopped_at = now()
  where delivery_tracking_active = true and id <> v_order.id;

  update public.orders set delivery_tracking_active = true, delivery_tracking_started_at = coalesce(delivery_tracking_started_at, now()), delivery_tracking_stopped_at = null where id = v_order.id;

  select json_build_object(
    'order_id', o.id, 'invoice_number', o.invoice_number, 'customer_name', c.name, 'customer_address', c.address,
    'customer_latitude', o.customer_latitude, 'customer_longitude', o.customer_longitude,
    'status', o.status, 'tracking_active', o.delivery_tracking_active
  ) into v_result from public.orders o join public.customers c on c.id = o.customer_id where o.id = v_order.id;
  return v_result;
end; $$;

create or replace function public.update_delivery_partner_location(p_token uuid, p_latitude double precision, p_longitude double precision)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'Invalid location coordinates'; end if;
  update public.orders set delivery_partner_latitude = p_latitude, delivery_partner_longitude = p_longitude, delivery_partner_location_updated_at = now()
  where delivery_tracking_token = p_token and delivery_tracking_active = true and status in ('out_for_delivery','delivered');
  if not found then raise exception 'Delivery tracking session is no longer active'; end if;
  return true;
end; $$;

create or replace function public.stop_delivery_tracking(p_token uuid, p_latitude double precision default null, p_longitude double precision default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90) then raise exception 'Invalid latitude'; end if;
  if p_longitude is not null and (p_longitude < -180 or p_longitude > 180) then raise exception 'Invalid longitude'; end if;
  update public.orders set
    delivery_partner_latitude = coalesce(p_latitude, delivery_partner_latitude),
    delivery_partner_longitude = coalesce(p_longitude, delivery_partner_longitude),
    delivery_partner_location_updated_at = case when p_latitude is not null and p_longitude is not null then now() else delivery_partner_location_updated_at end,
    delivery_tracking_active = false, delivery_tracking_stopped_at = now()
  where delivery_tracking_token = p_token and delivery_tracking_active = true;
  if not found then raise exception 'Delivery tracking session is not active'; end if;
  return true;
end; $$;

create or replace function public.get_delivery_partner_location(p_reference text)
returns json language sql security definer set search_path = public stable as $$
  select json_build_object('name', delivery_partner_name, 'mobile', delivery_partner_mobile, 'latitude', delivery_partner_latitude, 'longitude', delivery_partner_longitude, 'updated_at', delivery_partner_location_updated_at, 'active', delivery_tracking_active)
  from public.orders where (tracking_id = p_reference or invoice_number = p_reference) and status = 'out_for_delivery' limit 1;
$$;

revoke all on function public.get_delivery_assignment(uuid) from public;
revoke all on function public.start_delivery_tracking(uuid) from public;
revoke all on function public.update_delivery_partner_location(uuid,double precision,double precision) from public;
revoke all on function public.stop_delivery_tracking(uuid,double precision,double precision) from public;
revoke all on function public.get_delivery_partner_location(text) from public;
grant execute on function public.get_delivery_assignment(uuid) to anon, authenticated;
grant execute on function public.start_delivery_tracking(uuid) to anon, authenticated;
grant execute on function public.update_delivery_partner_location(uuid,double precision,double precision) to anon, authenticated;
grant execute on function public.stop_delivery_tracking(uuid,double precision,double precision) to anon, authenticated;
grant execute on function public.get_delivery_partner_location(text) to anon, authenticated;
