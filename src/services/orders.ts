import { supabase } from "@/lib/supabase";
import { generateTrackingId, normalizeMobile } from "@/lib/utils";
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

export async function listOrders(filters: OrderListFilters = {}) {
  const { status = "all", search = "", dateRange = "all", page = 1, pageSize = 20 } = filters;

  let query = supabase
    .from("orders")
    .select("*, customer:customers(name, mobile)", { count: "exact" })
    .order("order_date", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (dateRange !== "all") {
    const now = new Date();
    const from = new Date(now);
    if (dateRange === "today") from.setHours(0, 0, 0, 0);
    if (dateRange === "week") from.setDate(now.getDate() - 7);
    if (dateRange === "month") from.setDate(now.getDate() - 30);
    query = query.gte("order_date", from.toISOString().slice(0, 10));
  }

  if (search.trim()) {
    // Search across invoice number / tracking id directly; customer name/mobile
    // handled client-side after fetch for simplicity, or via a dedicated RPC
    // for larger datasets.
    query = query.or(
      `invoice_number.ilike.%${search}%,tracking_id.ilike.%${search}%`
    );
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

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  const { data: history } = await supabase
    .from("order_status_history")
    .select("*")
    .eq("order_id", orderId)
    .order("changed_at", { ascending: true });

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

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

/** Checks whether an invoice number is already in use (duplicate protection). */
export async function invoiceNumberExists(invoiceNumber: string, excludeOrderId?: string) {
  let query = supabase.from("orders").select("id").eq("invoice_number", invoiceNumber.trim());
  if (excludeOrderId) query = query.neq("id", excludeOrderId);
  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}

/** Creates (or reuses) a customer by mobile number, then creates the order + items. */
export async function createOrder(draft: DraftOrder): Promise<Order> {
  const mobile = normalizeMobile(draft.mobile);
  if (!draft.customerName.trim() || mobile.length < 10) {
    throw new Error("Please provide a valid customer name and 10-digit mobile number.");
  }
  if (!draft.invoiceNumber.trim()) {
    throw new Error("Invoice number is required.");
  }

  const duplicate = await invoiceNumberExists(draft.invoiceNumber);
  if (duplicate) {
    throw new Error(`Invoice number "${draft.invoiceNumber}" already exists. Please check before saving.`);
  }

  // Find or create the customer.
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("mobile", mobile)
    .maybeSingle();

  let customerId = existingCustomer?.id as string | undefined;

  if (!customerId) {
    const { data: newCustomer, error: customerError } = await supabase
      .from("customers")
      .insert({ name: draft.customerName.trim(), mobile, address: draft.address.trim() || null })
      .select("id")
      .single();
    if (customerError || !newCustomer) throw new Error(FRIENDLY_ERROR);
    customerId = newCustomer.id;
  } else {
    await supabase
      .from("customers")
      .update({ name: draft.customerName.trim(), address: draft.address.trim() || null })
      .eq("id", customerId);
  }

  const grandTotal = computeGrandTotal(draft);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      tracking_id: generateTrackingId(),
      customer_id: customerId,
      invoice_number: draft.invoiceNumber.trim(),
      invoice_date: draft.invoiceDate || null,
      order_date: draft.orderDate || new Date().toISOString().slice(0, 10),
      expected_delivery_date: draft.expectedDeliveryDate || null,
      status: draft.status,
      grand_total: grandTotal,
      notes: draft.notes.trim() || null,
      delivery_location_url: draft.deliveryLocationUrl.trim() || null,
    })
    .select("*")
    .single();

  if (orderError || !order) throw new Error(FRIENDLY_ERROR);

  const itemRows = draft.items
    .filter((i) => i.product_name.trim())
    .map((i) => ({
      order_id: order.id,
      product_name: i.product_name.trim(),
      quantity: parseFloat(i.quantity || "0") || 0,
      unit: i.unit || "pcs",
      price: parseFloat(i.price || "0") || 0,
      total: computeItemTotal(i.quantity, i.price),
    }));

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase.from("order_items").insert(itemRows);
    if (itemsError) throw new Error("Order was created, but items could not be saved. Please edit the order to add them.");
  }

  return order as Order;
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
  if (deleteError) throw new Error(FRIENDLY_ERROR);

  if (items.length === 0) return;

  const rows = items.map((i) => ({
    order_id: orderId,
    product_name: i.product_name,
    quantity: i.quantity,
    unit: i.unit,
    price: i.price,
    total: i.total,
  }));
  const { error: insertError } = await supabase.from("order_items").insert(rows);
  if (insertError) throw new Error(FRIENDLY_ERROR);
}

export interface DashboardCounts {
  total: number;
  today: number;
  atHub: number;
  outForDelivery: number;
  delivered: number;
  pending: number;
  cancelled: number;
}

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const today = new Date().toISOString().slice(0, 10);

  const [{ count: total }, { count: todayCount }, { count: atHub }, { count: outForDelivery }, { count: delivered }, { count: pending }, { count: cancelled }] =
    await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("order_date", today),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "arrived_at_hub"),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "out_for_delivery"),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "delivered"),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["order_created", "supplier_dispatched"]),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "cancelled"),
    ]);

  return {
    total: total ?? 0,
    today: todayCount ?? 0,
    atHub: atHub ?? 0,
    outForDelivery: outForDelivery ?? 0,
    delivered: delivered ?? 0,
    pending: pending ?? 0,
    cancelled: cancelled ?? 0,
  };
}
