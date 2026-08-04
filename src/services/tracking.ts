import { supabase } from "@/lib/supabase";
import type { OrderSearchSummary, OrderTrackingDetail } from "@/types/order";

export async function searchOrdersByMobile(mobile: string): Promise<OrderSearchSummary[]> {
  const { data, error } = await supabase.rpc("search_orders_by_mobile", { p_mobile: mobile });
  if (error) throw new Error("Unable to retrieve tracking information. Please try again.");
  interface RawRow {
    order_id: string;
    tracking_id: string;
    invoice_number: string;
    order_date: string;
    grand_total: number;
    status: OrderSearchSummary["status"];
    masked_mobile: string;
  }
  return ((data ?? []) as RawRow[]).map((row) => ({
    order_id: row.order_id,
    tracking_id: row.tracking_id,
    invoice_number: row.invoice_number,
    order_date: row.order_date,
    grand_total: row.grand_total,
    status: row.status,
    masked_mobile: row.masked_mobile,
  }));
}

export async function getOrderTracking(reference: string): Promise<OrderTrackingDetail | null> {
  const { data, error } = await supabase.rpc("get_order_tracking", { p_reference: reference.trim() });
  if (error) throw new Error("Unable to retrieve tracking information. Please try again.");
  return (data as OrderTrackingDetail | null) ?? null;
}

export interface PublicSettings {
  company_name: string;
  logo_url: string | null;
  business_phone: string | null;
  business_address: string | null;
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const { data, error } = await supabase.rpc("get_public_settings");
  if (error || !data) {
    return { company_name: "Srimalli Food Product", logo_url: null, business_phone: null, business_address: null };
  }
  return data as PublicSettings;
}
