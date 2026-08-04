import type { OrderStatus } from "@/types/database";

export interface WhatsAppContext {
  customerName: string;
  invoiceNumber: string;
  trackingId: string;
  expectedDeliveryText?: string;
  companyName: string;
}

const trackingUrl = (trackingId: string) => `${window.location.origin}/track/${trackingId}`;

export function buildWhatsAppMessage(status: OrderStatus, ctx: WhatsAppContext): string {
  const url = trackingUrl(ctx.trackingId);

  switch (status) {
    case "arrived_at_hub":
      return `Hello ${ctx.customerName},\n\nYour order (Invoice: ${ctx.invoiceNumber}) has arrived safely at our hub.\n\nOur delivery person will contact you regarding your location and delivery. Your order is expected to be delivered ${ctx.expectedDeliveryText || "today or tomorrow"}.\n\nTrack your order here:\n${url}\n\nThank you for choosing\n${ctx.companyName}.`;
    case "out_for_delivery":
      return `Hello ${ctx.customerName},\n\nGood news! Your order (Invoice: ${ctx.invoiceNumber}) is out for delivery. We expect to deliver your order today.\n\nTrack your order:\n${url}\n\nThank you,\n${ctx.companyName}.`;
    case "delivered":
      return `Hello ${ctx.customerName},\n\nYour order (Invoice: ${ctx.invoiceNumber}) has been delivered successfully.\n\nThank you for choosing ${ctx.companyName}. We look forward to serving you again.`;
    case "supplier_dispatched":
      return `Hello ${ctx.customerName},\n\nYour order (Invoice: ${ctx.invoiceNumber}) has been dispatched by our supplier and is on its way to our hub.\n\nTrack your order:\n${url}\n\nThank you,\n${ctx.companyName}.`;
    case "cancelled":
      return `Hello ${ctx.customerName},\n\nYour order (Invoice: ${ctx.invoiceNumber}) has been cancelled. Please contact us if you have any questions.\n\n${ctx.companyName}.`;
    default:
      return `Hello ${ctx.customerName},\n\nYour order (Invoice: ${ctx.invoiceNumber}) has been created and is being processed.\n\nTrack your order:\n${url}\n\nThank you for choosing ${ctx.companyName}.`;
  }
}

export function openWhatsApp(mobile: string, message: string) {
  const digits = mobile.replace(/\D/g, "");
  // Assumes India (+91) when a bare 10-digit number is stored; adjust here
  // if you operate in a different country.
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  const url = `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function buildCallLink(mobile: string): string {
  return `tel:${mobile.replace(/\D/g, "")}`;
}
