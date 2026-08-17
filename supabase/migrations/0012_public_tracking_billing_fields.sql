-- Public tracking billing fields. No table/schema change.
-- Exposes only billing address and notes through the existing public tracking RPC.
create or replace function public.get_order_tracking(p_reference text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_order public.orders%rowtype; v_result json;
begin
  select * into v_order from public.orders where tracking_id = p_reference or invoice_number = p_reference limit 1;
  if not found then return null; end if;
  select json_build_object(
    'order_id', v_order.id, 'tracking_id', v_order.tracking_id, 'invoice_number', v_order.invoice_number,
    'invoice_date', v_order.invoice_date, 'order_date', v_order.order_date, 'expected_delivery_date', v_order.expected_delivery_date,
    'status', v_order.status, 'grand_total', v_order.grand_total, 'billing_address', v_order.billing_address, 'notes', v_order.notes,
    'customer_name', c.name, 'masked_mobile', repeat('*', greatest(length(c.mobile) - 4, 0)) || right(c.mobile, 4),
    'delivery_location_url', v_order.delivery_location_url, 'customer_latitude', v_order.customer_latitude, 'customer_longitude', v_order.customer_longitude,
    'customer_map_link', v_order.customer_map_link,
    'items', (select coalesce(json_agg(json_build_object('product_name', oi.product_name, 'quantity', oi.quantity, 'unit', oi.unit, 'price', oi.price, 'total', oi.total) order by oi.created_at), '[]'::json) from public.order_items oi where oi.order_id = v_order.id),
    'timeline', (select coalesce(json_agg(json_build_object('previous_status', h.previous_status, 'new_status', h.new_status, 'changed_at', h.changed_at) order by h.changed_at), '[]'::json) from public.order_status_history h where h.order_id = v_order.id),
    'has_invoice', exists (select 1 from public.invoices i where i.order_id = v_order.id)
  ) into v_result from public.customers c where c.id = v_order.customer_id;
  return v_result;
end;
$$;
revoke all on function public.get_order_tracking(text) from public;
grant execute on function public.get_order_tracking(text) to anon, authenticated;
