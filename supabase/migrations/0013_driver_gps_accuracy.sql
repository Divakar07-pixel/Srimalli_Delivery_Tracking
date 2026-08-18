ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_partner_accuracy_m double precision;

CREATE OR REPLACE FUNCTION public.update_delivery_partner_location(
  p_token uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid location coordinates';
  end if;
  if p_accuracy_m is not null and (p_accuracy_m < 0 or p_accuracy_m > 100000) then
    raise exception 'Invalid GPS accuracy';
  end if;
  update public.orders
  set delivery_partner_latitude = p_latitude,
      delivery_partner_longitude = p_longitude,
      delivery_partner_accuracy_m = p_accuracy_m,
      delivery_partner_location_updated_at = now()
  where delivery_tracking_token = p_token
    and delivery_tracking_active = true
    and status in ('out_for_delivery','delivered');
  if not found then
    raise exception 'Delivery tracking session is no longer active';
  end if;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_delivery_partner_location(p_reference text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
select json_build_object(
  'name', delivery_partner_name,
  'mobile', delivery_partner_mobile,
  'latitude', delivery_partner_latitude,
  'longitude', delivery_partner_longitude,
  'accuracy_m', delivery_partner_accuracy_m,
  'updated_at', delivery_partner_location_updated_at,
  'active', delivery_tracking_active
)
from public.orders
where (tracking_id = p_reference or invoice_number = p_reference)
  and status = 'out_for_delivery'
limit 1;
$function$;
