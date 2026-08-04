import type { OrderStatus } from "./database";

export interface TrackingItem {
  product_name: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
}

export interface TrackingTimelineEntry {
  previous_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_at: string;
}

export interface OrderTrackingDetail {
  order_id: string;
  tracking_id: string;
  invoice_number: string;
  invoice_date: string | null;
  order_date: string;
  expected_delivery_date: string | null;
  status: OrderStatus;
  grand_total: number;
  customer_name: string;
  masked_mobile: string;
  delivery_location_url?: string | null;
  items: TrackingItem[];
  timeline: TrackingTimelineEntry[];
  has_invoice: boolean;
}

export interface OrderSearchSummary {
  order_id: string;
  tracking_id: string;
  invoice_number: string;
  order_date: string;
  grand_total: number;
  status: OrderStatus;
  masked_mobile: string;
}

/** Shape used by the admin "add order" forms before persistence. */
export interface DraftOrderItem {
  id: string; // client-side temp id
  product_name: string;
  quantity: string;
  unit: string;
  price: string;
}

export interface DraftOrder {
  customerName: string;
  mobile: string;
  address: string;
  invoiceNumber: string;
  invoiceDate: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: OrderStatus;
  notes: string;
  deliveryLocationUrl: string;
  grandTotalOverride: string; // empty = use computed sum
  items: DraftOrderItem[];
}
