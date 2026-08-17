import { supabase } from "@/lib/supabase";
import type { OrderSearchSummary, OrderTrackingDetail } from "@/types/order";

export async function searchOrdersByMobile(mobile: string): Promise<OrderSearchSummary[]> {
  const { data, error } = await supabase.rpc("search_orders_by_mobile", { p_mobile: mobile });
  if (error) throw new Error("Unable to retrieve tracking information. Please try again.");
  interface RawRow { order_id: string; tracking_id: string; invoice_number: string; order_date: string; grand_total: number; status: OrderSearchSummary["status"]; masked_mobile: string; }
  return ((data ?? []) as RawRow[]).map((row) => ({ order_id: row.order_id, tracking_id: row.tracking_id, invoice_number: row.invoice_number, order_date: row.order_date, grand_total: row.grand_total, status: row.status, masked_mobile: row.masked_mobile }));
}

export async function getOrderTracking(reference: string): Promise<OrderTrackingDetail | null> {
  const { data, error } = await supabase.rpc("get_order_tracking", { p_reference: reference.trim() });
  if (error) throw new Error("Unable to retrieve tracking information. Please try again.");
  const detail = (data as OrderTrackingDetail | null) ?? null;
  if (!detail) return null;

  if (detail.customer_latitude == null || detail.customer_longitude == null) {
    const mapUrl = detail.customer_map_link || detail.delivery_location_url;
    if (mapUrl) {
      const coordinates = await resolveDeliveryCoordinates(mapUrl).catch(() => null);
      if (coordinates) return { ...detail, customer_latitude: coordinates.lat, customer_longitude: coordinates.lng };
    }
  }

  return detail;
}

export interface PublicSettings { company_name: string; logo_url: string | null; business_phone: string | null; business_address: string | null; shop_latitude: number | null; shop_longitude: number | null; }
export interface DeliveryPartnerLocation { name: string | null; mobile: string | null; latitude: number | null; longitude: number | null; updated_at: string | null; active: boolean; }

export async function getDeliveryPartnerLocation(reference: string): Promise<DeliveryPartnerLocation | null> {
  const { data, error } = await supabase.rpc("get_delivery_partner_location", { p_reference: reference.trim() });
  if (error) throw new Error("Unable to retrieve the delivery partner location.");
  return (data as DeliveryPartnerLocation | null) ?? null;
}

export interface DeliveryAssignment {
  order_id: string;
  invoice_number: string;
  customer_name: string;
  customer_address: string | null;
  customer_latitude: number | null;
  customer_longitude: number | null;
  status: "out_for_delivery" | "delivered";
  tracking_active: boolean;
}

export async function getDeliveryAssignment(token: string): Promise<DeliveryAssignment | null> {
  const { data, error } = await supabase.rpc("get_delivery_assignment", { p_token: token });
  if (error) throw new Error("This delivery link is invalid or has expired.");
  return (data as DeliveryAssignment | null) ?? null;
}

export async function startDeliveryTracking(token: string): Promise<DeliveryAssignment | null> {
  const { data, error } = await supabase.rpc("start_delivery_tracking", { p_token: token });
  if (error) throw new Error(error.message || "Unable to start delivery tracking.");
  return (data as DeliveryAssignment | null) ?? null;
}

export async function updateDeliveryPartnerLocation(token: string, latitude: number, longitude: number) {
  const { error } = await supabase.rpc("update_delivery_partner_location", { p_token: token, p_latitude: latitude, p_longitude: longitude });
  if (error) throw new Error("Unable to share your location. Please try again.");
}

export async function stopDeliveryTracking(token: string, latitude?: number, longitude?: number) {
  const { error } = await supabase.rpc("stop_delivery_tracking", { p_token: token, p_latitude: latitude ?? null, p_longitude: longitude ?? null });
  if (error) throw new Error(error.message || "Unable to stop delivery tracking.");
}

export async function resolveDeliveryCoordinates(url: string): Promise<{ lat: number; lng: number } | null> {
  const { data, error } = await supabase.functions.invoke("resolve-delivery-location", { body: { url } });
  if (error || !data || typeof data.lat !== "number" || typeof data.lng !== "number") return null;
  return { lat: data.lat, lng: data.lng };
}

/** Best-effort Realtime subscription. Public tracking retains polling as the fallback because RLS must not be weakened. */
export function subscribeToDeliveryLocation(orderId: string, onChange: () => void) {
  const channel = supabase.channel(`delivery-location:${orderId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, onChange).subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const { data, error } = await supabase.rpc("get_public_settings");
  if (error || !data) return { company_name: "Srimalli Food Product", logo_url: null, business_phone: null, business_address: null, shop_latitude: null, shop_longitude: null };
  return data as PublicSettings;
}
