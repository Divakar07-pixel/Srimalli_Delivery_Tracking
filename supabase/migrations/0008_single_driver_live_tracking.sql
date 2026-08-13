-- One reusable delivery partner, plus a private per-order link for GPS sharing.
alter table public.settings
  add column if not exists delivery_partner_name text,
  add column if not exists delivery_partner_mobile text;

alter table public.orders
  add column if not exists delivery_tracking_token uuid unique;

create or replace function public.get_delivery_assignment(p_token uuid)
returns json
language sql
security definer
set search_path = public
stable
as $$
  select json_build_object(
    'invoice_number', o.invoice_number,
    'customer_name', c.name,
    'customer_latitude', o.customer_latitude,
    'customer_longitude', o.customer_longitude
  )
  from public.orders o
  join public.customers c on c.id = o.customer_id
  where o.delivery_tracking_token = p_token
    and o.status = 'out_for_delivery'
  limit 1;
$$;

create or replace function public.update_delivery_partner_location(
  p_token uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid location coordinates';
  end if;

  update public.orders
  set delivery_partner_latitude = p_latitude,
      delivery_partner_longitude = p_longitude,
      delivery_partner_location_updated_at = now()
  where delivery_tracking_token = p_token
    and status = 'out_for_delivery';

  if not found then
    raise exception 'Delivery link is invalid or the order is not out for delivery';
  end if;
  return true;
end;
$$;

revoke all on function public.get_delivery_assignment(uuid) from public;
revoke all on function public.update_delivery_partner_location(uuid, double precision, double precision) from public;
grant execute on function public.get_delivery_assignment(uuid) to anon, authenticated;
grant execute on function public.update_delivery_partner_location(uuid, double precision, double precision) to anon, authenticated;
