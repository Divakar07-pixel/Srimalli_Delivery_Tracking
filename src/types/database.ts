export type OrderStatus = "order_created" | "supplier_dispatched" | "arrived_at_hub" | "out_for_delivery" | "delivered" | "cancelled";
export type AppRole = "admin";
export interface Profile { id: string; name: string; email: string; role: AppRole; created_at: string; updated_at: string; }
export interface Customer { id: string; name: string; mobile: string; address: string | null; created_at: string; updated_at: string; }
export interface Order {
  id: string; tracking_id: string; customer_id: string; invoice_number: string; invoice_date: string | null; order_date: string; expected_delivery_date: string | null;
  status: OrderStatus; grand_total: number; billing_address: string | null; notes: string | null; delivery_location_url: string | null; customer_latitude: number | null; customer_longitude: number | null; customer_map_link: string | null;
  delivery_partner_name: string | null; delivery_partner_mobile: string | null; delivery_partner_latitude: number | null; delivery_partner_longitude: number | null; delivery_partner_location_updated_at: string | null;
  delivery_tracking_token: string | null; delivery_tracking_active: boolean; delivery_tracking_started_at: string | null; delivery_tracking_stopped_at: string | null; created_at: string; updated_at: string;
}
export interface OrderItem { id: string; order_id: string; product_name: string; quantity: number; unit: string; price: number; total: number; created_at: string; }
export interface Invoice { id: string; order_id: string; file_url: string | null; file_path: string; file_type: string; original_filename: string | null; created_at: string; }
export interface OrderStatusHistoryRow { id: string; order_id: string; previous_status: OrderStatus | null; new_status: OrderStatus; changed_at: string; }
export interface Settings { id: number; company_name: string; logo_url: string | null; business_phone: string | null; business_address: string | null; whatsapp_template_arrived: string | null; whatsapp_template_out_for_delivery: string | null; whatsapp_template_delivered: string | null; default_expected_delivery_text: string | null; theme: string; shop_latitude: number | null; shop_longitude: number | null; delivery_partner_name: string | null; delivery_partner_mobile: string | null; updated_at: string; }

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      customers: { Row: Customer; Insert: Partial<Customer>; Update: Partial<Customer> };
      orders: { Row: Order; Insert: Partial<Order>; Update: Partial<Order> };
      order_items: { Row: OrderItem; Insert: Partial<OrderItem>; Update: Partial<OrderItem> };
      invoices: { Row: Invoice; Insert: Partial<Invoice>; Update: Partial<Invoice> };
      order_status_history: { Row: OrderStatusHistoryRow; Insert: Partial<OrderStatusHistoryRow>; Update: Partial<OrderStatusHistoryRow> };
      settings: { Row: Settings; Insert: Partial<Settings>; Update: Partial<Settings> };
    };
    Views: Record<string, never>;
    Functions: {
      search_orders_by_mobile: { Args: { p_mobile: string }; Returns: { order_id: string; tracking_id: string; invoice_number: string; order_date: string; grand_total: number; status: OrderStatus; masked_mobile: string }[] };
      get_order_tracking: { Args: { p_reference: string }; Returns: unknown };
      get_public_settings: { Args: Record<string, never>; Returns: unknown };
      get_delivery_assignment: { Args: { p_token: string }; Returns: unknown };
      start_delivery_tracking: { Args: { p_token: string }; Returns: unknown };
      update_delivery_partner_location: { Args: { p_token: string; p_latitude: number; p_longitude: number }; Returns: boolean };
      stop_delivery_tracking: { Args: { p_token: string; p_latitude?: number | null; p_longitude?: number | null }; Returns: boolean };
      get_delivery_partner_location: { Args: { p_reference: string }; Returns: unknown };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
