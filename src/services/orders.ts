import { supabase } from "@/lib/supabase";
import { generateTrackingId, isSafeExternalUrl, normalizeMobile } from "@/lib/utils";
import { isGoogleMapsLink, parseCoordinates } from "@/lib/map";
import type { DraftOrder } from "@/types/order";
import type { Order, OrderItem, OrderStatus } from "@/types/database";

export interface OrderListFilters {
  status?: OrderStatus | "all";
  search?: string;
  dateRange?: "today" | "week" | "month" | "all";
  page?: number;
  pageSize?: number;
}

export interface OrderListRow extends Order {
  customer: { name: string; mobile: string } | null;
}

const FRIENDLY_ERROR = "Unable to save order. Please check the information and try again.";

type DatabaseError = { code?: string; message?: string } | null;

function getSaveErrorMessage(error: DatabaseError): string {
  if (error?.code === "23505") {
    return "This invoice number already exists. Please use a unique invoice number.";
  }
  if (error?.code === "42501") {
    return "Your account does not have permission to save orders. Please sign in as an administrator.";
  }
  if (error?.code === "PGRST204") {
    return "The database schema is out of date. Apply the latest database migration and try again.";
  }
  return error?.message || FRIENDLY_ERROR;
}

export async function listOrders(filters: OrderListFilters = {}) {
  const { status = "all", search = "", dateRange = "all", page = 1, pageSize = 20 } = filters;

  let query = supabase
    .from("orders")
    .select("*, customer:customers(name, mobile)", { count: "exact" })
    .order("order_date", { ascending: false });

  if (status !== "all") query = query.eq("status", status);

  if (dateRange !== "all") {
    const now = new Date();
    const from = new Date(now);
    if (dateRange === "today") from.setHours(0, 0, 0, 0);
    if (dateRange === "week") from.setDate(now.getDate() - 7);
    if (dateRange === "month") from.setDate(now.getDate() - 30);
    query = query.gte("order_date", from.toISOString().slice(0, 10));
  }

  if (search.trim()) {
    const digits = normalizeMobile(search);
    if (digits.length >= 6) {
      const { data: matchingCustomers, error: customerError } = await supabase
        .from("customers")
        .select("id")
        .ilike("mobile", `%${digits}%`);
      if (customerError) throw new Error("Unable to search orders. Please try again.");
      const customerIds = (matchingCustomers ?? []).map((customer) => customer.id);
      if (customerIds.length === 0) return { rows: [], count: 0 };
      query = query.in("customer_id", customerIds);
    } else {
      query = query.or(`invoice_number.ilike.%${search}%,tracking_id.ilike.%${search}%`);
    }
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error("Unable to load orders. Please try again.");
  return { rows: (data ?? []) as unknown as OrderListRow[], count: count ?? 0 };
}

export async function getOrderDetail(orderId: string) {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*, customer:customers(*)")
    .eq("id", orderId)
    .single();
  if (orderError || !order) throw new Error("Unable to load this order.");

  const { data: items } = await supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at", { ascending: true });
  const { data: history } = await supabase.from("order_status_history").select("*").eq("order_id", orderId).order("changed_at", { ascending: true });
  const { data: invoices } = await supabase.from("invoices").select("*").eq("order_id", orderId).order("created_at", { ascending: false });

  return { order, items: (items ?? []) as OrderItem[], history: history ?? [], invoices: invoices ?? [] };
}

export function computeItemTotal(quantity: string, price: string): number {
  const q = parseFloat(quantity || "0");
  const p = parseFloat(price || "0");
  if (Number.isNaN(q) || Number.isNaN(p)) return 0;
  return Math.round(q * p * 100) / 100;
}

export function computeGrandTotal(draft: DraftOrder): number {
  if (draft.grandTotalOverride.trim()) {
    const override = parseFloat(draft.grandTotalOverride);
    if (!Number.isNaN(override)) return override;
  }
  return draft.items.reduce((sum, item) => sum + computeItemTotal(item.quantity, item.price), 0);
}

export interface ExistingCustomerOrderDefaults {
  customer: { id: string; name: string; mobile: string; address: string | null };
  previousOrder: Pick<Order, "id" | "customer_map_link" | "delivery_location_url" | "customer_latitude" | "customer_longitude"> | null;
}

/** Finds an existing customer by mobile and returns their latest saved delivery location. */
export async function getExistingCustomerOrderDefaults(mobile: string): Promise<ExistingCustomerOrderDefaults | null> {
  const normalized = normalizeMobile(mobile);
  if (normalized.length < 10) return null;

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, name, mobile, address")
    .eq("mobile", normalized)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (customerError || !customer) return null;

  const { data: previousOrder } = await supabase
    .from("orders")
    .select("id, customer_map_link, delivery_location_url, customer_latitude, customer_longitude")
    .eq("customer_id", customer.id)
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { customer, previousOrder: previousOrder ?? null };
}

export async function invoiceNumberExists(invoiceNumber: string, excludeOrderId?: string) {
  let query = supabase.from("orders").select("id").eq("invoice_number", invoiceNumber.trim());
  if (excludeOrderId) query = query.neq("id", excludeOrderId);
  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}

/** Creates (or reuses) a customer by mobile number, then creates the order + items. */
export async function createOrder(draft: DraftOrder): Promise<Order> {
  const mobile = normalizeMobile(draft.mobile);
  if (!draft.customerName.trim() || mobile.length < 10) throw new Error("Please provide a valid customer name and 10-digit mobile number.");
  if (!draft.invoiceNumber.trim()) throw new Error("Invoice number is required.");
  if (draft.deliveryLocationUrl.trim() && !isSafeExternalUrl(draft.deliveryLocationUrl)) throw new Error("Please enter a valid Google Maps or website link starting with https://.");

  const coords = parseCoordinates(draft.customerMapLink);
  if (draft.customerMapLink.trim() && !coords && !isGoogleMapsLink(draft.customerMapLink)) throw new Error("We couldn't detect coordinates in that map link. Please use a Google Maps share/pin link.");

  const duplicate = await invoiceNumberExists(draft.invoiceNumber);
  if (duplicate) throw new Error(`Invoice number "${draft.invoiceNumber}" already exists. Please check before saving.`);

  const existingDefaults = await getExistingCustomerOrderDefaults(mobile);
  let customerId = existingDefaults?.customer.id as string | undefined;

  if (!customerId) {
    const { data: newCustomer, error: customerError } = await supabase
      .from("customers")
      .insert({ name: draft.customerName.trim(), mobile, address: draft.address.trim() || null })
      .select("id")
      .single();
    if (customerError || !newCustomer) throw new Error(getSaveErrorMessage(customerError));
    customerId = newCustomer.id;
  } else {
    const customerPatch: { name?: string; address?: string | null } = {};
    if (draft.customerName.trim()) customerPatch.name = draft.customerName.trim();
    if (draft.address.trim()) customerPatch.address = draft.address.trim();
    if (Object.keys(customerPatch).length > 0) await supabase.from("customers").update(customerPatch).eq("id", customerId);
  }

  // Repeat customers reuse the latest delivery location unless the admin explicitly enters a new one.
  const previousLocation = existingDefaults?.previousOrder;
  const effectiveMapLink = draft.customerMapLink.trim() || previousLocation?.customer_map_link || previousLocation?.delivery_location_url || "";
  const effectiveCoords = parseCoordinates(effectiveMapLink);
  const effectiveLatitude = coords?.lat ?? previousLocation?.customer_latitude ?? effectiveCoords?.lat ?? null;
  const effectiveLongitude = coords?.lng ?? previousLocation?.customer_longitude ?? effectiveCoords?.lng ?? null;

  const grandTotal = computeGrandTotal(draft);
  const { data: order, error: orderError } = await supabase.from("orders").insert({
    tracking_id: generateTrackingId(),
    customer_id: customerId,
    invoice_number: draft.invoiceNumber.trim(),
    invoice_date: draft.invoiceDate || null,
    order_date: draft.orderDate || new Date().toISOString().slice(0, 10),
    billing_address: draft.address.trim() || existingDefaults?.customer.address || null,
    expected_delivery_date: draft.expectedDeliveryDate || null,
    status: draft.status,
    grand_total: grandTotal,
    notes: draft.notes.trim() || null,
    delivery_location_url: effectiveMapLink || null,
    customer_latitude: effectiveLatitude,
    customer_longitude: effectiveLongitude,
    customer_map_link: effectiveMapLink || null,
    delivery_tracking_token: crypto.randomUUID(),
  }).select("*").single();

  if (orderError || !order) {
    if (orderError?.code === "23505") throw new Error(`Invoice number "${draft.invoiceNumber.trim()}" already exists. Please use a unique invoice number.`);
    throw new Error(getSaveErrorMessage(orderError));
  }

  const itemRows = draft.items.filter((i) => i.product_name.trim()).map((i) => ({
    order_id: order.id,
    product_name: i.product_name.trim(),
    quantity: parseFloat(i.quantity || "0") || 0,
    unit: i.unit || "pcs",
    price: parseFloat(i.price || "0") || 0,
    total: computeItemTotal(i.quantity, i.price),
  }));

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase.from("order_items").insert(itemRows);
    if (itemsError) throw new Error(`Order was created, but items could not be saved: ${getSaveErrorMessage(itemsError)}`);
  }
  return order as Order;
}

export async function updateCustomer(customerId: string, patch: { name?: string; mobile?: string; address?: string | null }) {
  const clean = {
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.mobile !== undefined ? { mobile: normalizeMobile(patch.mobile) } : {}),
    ...(patch.address !== undefined ? { address: patch.address?.trim() || null } : {}),
  };
  const { error } = await supabase.from("customers").update(clean).eq("id", customerId);
  if (error) throw new Error("Unable to save customer information. Please try again.");
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw new Error("Unable to update delivery status. Please try again.");
}

export async function updateOrder(orderId: string, patch: Partial<Order>) {
  const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
  if (error) throw new Error("Unable to save changes. Please try again.");
}

export async function deleteOrder(orderId: string) {
  const { error } = await supabase.from("orders").delete().eq("id", orderId);
  if (error) throw new Error("Unable to delete this order. Please try again.");
}

export async function replaceOrderItems(orderId: string, items: OrderItem[]) {
  const { error: deleteError } = await supabase.from("order_items").delete().eq("order_id", orderId);
  if (deleteError) throw new Error(getSaveErrorMessage(deleteError));
  if (items.length === 0) return;
  const rows = items.map((i) => ({ order_id: orderId, product_name: i.product_name, quantity: i.quantity, unit: i.unit, price: i.price, total: i.total }));
  const { error: insertError } = await supabase.from("order_items").insert(rows);
  if (insertError) throw new Error(getSaveErrorMessage(insertError));
}

export interface DashboardCounts { total: number; today: number; atHub: number; outForDelivery: number; deliveredToday: number; pending: number; cancelled: number; }

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const today = new Date().toISOString().slice(0, 10);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [{ count: total }, { count: todayCount }, { count: atHub }, { count: outForDelivery }, { count: deliveredToday }, { count: pending }, { count: cancelled }] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("order_date", today),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "arrived_at_hub"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "out_for_delivery"),
    supabase.from("order_status_history").select("*", { count: "exact", head: true }).eq("new_status", "delivered").gte("changed_at", todayStart.toISOString()),
    supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["order_created", "supplier_dispatched"]),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "cancelled"),
  ]);
  return { total: total ?? 0, today: todayCount ?? 0, atHub: atHub ?? 0, outForDelivery: outForDelivery ?? 0, deliveredToday: deliveredToday ?? 0, pending: pending ?? 0, cancelled: cancelled ?? 0 };
}
