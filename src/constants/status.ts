import type { OrderStatus } from "@/types/database";

export const ACTIVE_STATUS_FLOW: OrderStatus[] = [
  "order_created",
  "supplier_dispatched",
  "arrived_at_hub",
  "out_for_delivery",
  "delivered",
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  order_created: "Order Created",
  supplier_dispatched: "Supplier Dispatched",
  arrived_at_hub: "Arrived at Hub",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  order_created: "bg-secondary text-secondary-foreground",
  supplier_dispatched: "bg-warning/15 text-warning",
  arrived_at_hub: "bg-accent text-accent-foreground",
  out_for_delivery: "bg-primary/15 text-primary",
  delivered: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

export const STATUS_FILTERS: { label: string; value: OrderStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Created", value: "order_created" },
  { label: "Supplier Dispatched", value: "supplier_dispatched" },
  { label: "Arrived at Hub", value: "arrived_at_hub" },
  { label: "Out for Delivery", value: "out_for_delivery" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

export const UNIT_OPTIONS = ["pcs", "kg", "g", "L", "ml", "box", "packet", "bottle", "dozen"];
