import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Phone, Eye, Download, Trash2, Save, MapPin, Navigation, Copy, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { WhatsAppPanel } from "@/components/orders/WhatsAppPanel";
import { OrderTimeline } from "@/components/tracking/OrderTimeline";
import { ItemsEditor, blankItem } from "@/components/orders/ItemsEditor";
import { MapLinkInput } from "@/components/map/MapLinkInput";
import { getOrderDetail, updateOrderStatus, updateOrder, deleteOrder, replaceOrderItems, computeItemTotal } from "@/services/orders";
import { getAdminInvoiceSignedUrl } from "@/services/invoices";
import { getSettings } from "@/services/settings";
import { buildCallLink } from "@/services/whatsapp";
import { formatCurrency, formatDate, isSafeExternalUrl } from "@/lib/utils";
import { isGoogleMapsLink, parseCoordinates, type LatLng } from "@/lib/map";
import { ACTIVE_STATUS_FLOW, STATUS_LABEL } from "@/constants/status";
import { useToast } from "@/hooks/useToast";
import type { Order, OrderItem, OrderStatusHistoryRow, Invoice, Customer } from "@/types/database";
import type { DraftOrderItem } from "@/types/order";

function extractDeliveryCharge(notes: string | null | undefined) {
  const match = (notes ?? "").match(/\[\[delivery_charge=([0-9]+(?:\.[0-9]+)?)\]\]/);
  return match?.[1] ?? "";
}

function withDeliveryCharge(notes: string, charge: string) {
  const cleanNotes = notes.replace(/\[\[delivery_charge=[^\]]*\]\]\n?/g, "").trim();
  const amount = parseFloat(charge || "0");
  return Number.isFinite(amount) && amount > 0 ? `[[delivery_charge=${Math.round(amount * 100) / 100}]]${cleanNotes ? `\n${cleanNotes}` : ""}` : cleanNotes;
}

export function OrderDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [order, setOrder] = useState<(Order & { customer: Customer }) | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [history, setHistory] = useState<OrderStatusHistoryRow[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("Srimalli Food Product");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<Order["status"] | null>(null);
  const [shop, setShop] = useState<LatLng | null>(null);
  const [editItems, setEditItems] = useState<DraftOrderItem[]>([]);
  const [notes, setNotes] = useState("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [customerMapLink, setCustomerMapLink] = useState("");
  const [grandTotalOverride, setGrandTotalOverride] = useState("");
  const [deliveryCharges, setDeliveryCharges] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerMobile, setPartnerMobile] = useState("");
  const [partnerLocation, setPartnerLocation] = useState<LatLng | null>(null);

  const load = () => {
    setLoading(true);
    getOrderDetail(id)
      .then(({ order, items, history, invoices }) => {
        setOrder(order as Order & { customer: Customer });
        setItems(items);
        setHistory(history);
        setInvoices(invoices);
        setNotes(order.notes ?? "");
        setExpectedDelivery(order.expected_delivery_date ?? "");
        setCustomerMapLink(order.customer_map_link ?? order.delivery_location_url ?? "");
        setGrandTotalOverride(String(order.grand_total ?? ""));
        setDeliveryCharges(extractDeliveryCharge(order.notes));
        setPartnerName(order.delivery_partner_name ?? "");
        setPartnerMobile(order.delivery_partner_mobile ?? "");
        setPartnerLocation(order.delivery_partner_latitude != null && order.delivery_partner_longitude != null ? { lat: order.delivery_partner_latitude, lng: order.delivery_partner_longitude } : null);
        setEditItems(items.length ? items.map((i) => ({ id: i.id, product_name: i.product_name, quantity: String(i.quantity), unit: i.unit, price: String(i.price) })) : [blankItem()]);
      })
      .catch((e) => toast({ title: "Couldn't load order", description: (e as Error).message, variant: "error" }))
      .finally(() => setLoading(false));
  };

  const useCurrentPartnerLocation = () => {
    if (!navigator.geolocation) { toast({ title: "Location unavailable", description: "This browser does not support location sharing.", variant: "error" }); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => { setPartnerLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); toast({ title: "Partner location captured", variant: "success" }); },
      () => toast({ title: "Location unavailable", description: "Allow location access and try again.", variant: "error" }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 }
    );
  };

  useEffect(() => {
    load();
    getSettings().then((s) => {
      setCompanyName(s.company_name);
      if (s.shop_latitude != null && s.shop_longitude != null) setShop({ lat: s.shop_latitude, lng: s.shop_longitude });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const ensureDriverLink = async () => {
    if (!order) throw new Error("Order is not loaded.");
    const token = order.delivery_tracking_token ?? crypto.randomUUID();
    if (!order.delivery_tracking_token) {
      await updateOrder(order.id, { delivery_tracking_token: token });
      setOrder((current) => current ? { ...current, delivery_tracking_token: token } : current);
    }
    return `${window.location.origin}${import.meta.env.BASE_URL}deliver/${token}`;
  };

  const copyDriverLink = async () => {
    try {
      const link = await ensureDriverLink();
      if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(link);
      else {
        const input = document.createElement("textarea");
        input.value = link; input.style.position = "fixed"; input.style.opacity = "0";
        document.body.appendChild(input); input.select();
        const copied = document.execCommand("copy"); input.remove();
        if (!copied) throw new Error("Copy was blocked by this browser.");
      }
      toast({ title: "Driver tracking link copied", description: "Send it to your delivery partner on WhatsApp.", variant: "success" });
    } catch (error) { toast({ title: "Couldn't copy driver link", description: (error as Error).message, variant: "error" }); }
  };

  const openDriverLink = async () => {
    try {
      const link = await ensureDriverLink();
      window.open(link, "_blank", "noopener,noreferrer");
    } catch (error) { toast({ title: "Couldn't open driver GPS", description: (error as Error).message, variant: "error" }); }
  };

  const performStatusUpdate = async (status: Order["status"]) => {
    if (updatingStatus) return;
    setUpdatingStatus(true);
    try {
      if (status === "out_for_delivery" && order) {
        const settings = await getSettings();
        await updateOrder(order.id, {
          delivery_tracking_token: order.delivery_tracking_token ?? crypto.randomUUID(),
          delivery_partner_name: order.delivery_partner_name ?? settings.delivery_partner_name ?? null,
          delivery_partner_mobile: order.delivery_partner_mobile ?? settings.delivery_partner_mobile ?? null,
        });
      }
      await updateOrderStatus(id, status);
      setPendingStatus(null);
      toast({ title: `Marked as ${STATUS_LABEL[status]}`, variant: "success" });
      load();
    } catch (e) { toast({ title: "Couldn't update status", description: (e as Error).message, variant: "error" }); }
    finally { setUpdatingStatus(false); }
  };

  const handleStatusRequest = (status: Order["status"]) => setPendingStatus(status);

  const handleViewInvoice = async (mode: "view" | "download") => {
    if (!invoices[0]) return;
    try {
      const url = await getAdminInvoiceSignedUrl(invoices[0].file_path);
      if (mode === "download") { const a = document.createElement("a"); a.href = url; a.download = invoices[0].original_filename ?? "invoice"; a.click(); }
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) { toast({ title: "Couldn't open invoice", description: (e as Error).message, variant: "error" }); }
  };

  const handleDelete = async () => {
    try { await deleteOrder(id); toast({ title: "Order deleted", variant: "success" }); navigate("/admin/orders"); }
    catch (e) { toast({ title: "Couldn't delete order", description: (e as Error).message, variant: "error" }); }
  };

  const handleSaveEdit = async () => {
    if (!order) return;
    const coords = parseCoordinates(customerMapLink);
    if (customerMapLink.trim() && !coords && !isGoogleMapsLink(customerMapLink)) { toast({ title: "Invalid map link", description: "We couldn't detect coordinates in that Google Maps link.", variant: "error" }); return; }
    setSaving(true);
    try {
      const validItems = editItems.filter((i) => i.product_name.trim());
      const computedTotal = Math.round(validItems.reduce((sum, i) => sum + computeItemTotal(i.quantity, i.price), 0) * 100) / 100;
      const charge = parseFloat(deliveryCharges || "0");
      const safeCharge = Number.isFinite(charge) && charge > 0 ? Math.round(charge * 100) / 100 : 0;
      const calculatedTotal = Math.round((computedTotal + safeCharge) * 100) / 100;
      const override = parseFloat(grandTotalOverride);
      const hasOverride = grandTotalOverride.trim() !== "" && Number.isFinite(override);
      const finalTotal = hasOverride ? override : calculatedTotal;
      await updateOrder(order.id, {
        notes: withDeliveryCharge(notes, deliveryCharges),
        expected_delivery_date: expectedDelivery || null,
        delivery_location_url: customerMapLink.trim() || null,
        customer_map_link: customerMapLink.trim() || null,
        customer_latitude: coords?.lat ?? null,
        customer_longitude: coords?.lng ?? null,
        delivery_partner_name: partnerName.trim() || null,
        delivery_partner_mobile: partnerMobile.trim() || null,
        delivery_partner_latitude: partnerLocation?.lat ?? null,
        delivery_partner_longitude: partnerLocation?.lng ?? null,
        delivery_partner_location_updated_at: partnerLocation ? new Date().toISOString() : null,
        grand_total: finalTotal,
      });
      await replaceOrderItems(order.id, validItems.map((i) => ({ id: i.id, order_id: order.id, product_name: i.product_name.trim(), quantity: parseFloat(i.quantity || "0") || 0, unit: i.unit || "pcs", price: parseFloat(i.price || "0") || 0, total: computeItemTotal(i.quantity, i.price), created_at: "" })));
      toast({ title: "Order updated", variant: "success" }); setEditing(false); load();
    } catch (e) { toast({ title: "Couldn't save changes", description: (e as Error).message, variant: "error" }); }
    finally { setSaving(false); }
  };

  if (loading || !order) return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  const currentIndex = ACTIVE_STATUS_FLOW.indexOf(order.status);
  const nextStatus = order.status !== "cancelled" && currentIndex >= 0 && currentIndex < ACTIVE_STATUS_FLOW.length - 1 ? ACTIVE_STATUS_FLOW[currentIndex + 1] : null;
  const previousStatus = order.status === "delivered" ? "out_for_delivery" : order.status === "out_for_delivery" ? "arrived_at_hub" : null;

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between"><Link to="/admin/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to orders</Link><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /></Button></div>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">Order #{order.invoice_number} · {order.tracking_id}</p><h1 className="text-xl font-semibold">{order.customer?.name}</h1></div><StatusBadge status={order.status} /></div>

      <div className="flex flex-wrap gap-2">
        {order.customer?.mobile && <><Button asChild variant="outline"><a href={buildCallLink(order.customer.mobile)}><Phone className="h-4 w-4" />Call Customer</a></Button><WhatsAppPanel mobile={order.customer.mobile} customerName={order.customer.name} invoiceNumber={order.invoice_number} trackingId={order.tracking_id} status={order.status} companyName={companyName} /></>}
        {previousStatus && <Button variant="outline" onClick={() => handleStatusRequest(previousStatus)} disabled={updatingStatus}><ArrowLeft className="h-4 w-4" />Back to {STATUS_LABEL[previousStatus]}</Button>}
        {nextStatus && <Button onClick={() => handleStatusRequest(nextStatus)} loading={updatingStatus} disabled={updatingStatus}>Mark {STATUS_LABEL[nextStatus]}</Button>}
        {order.status !== "cancelled" && order.status !== "delivered" && <Button variant="destructive" onClick={() => handleStatusRequest("cancelled")} disabled={updatingStatus}>Cancel Order</Button>}
      </div>

      <Card><CardHeader><CardTitle className="text-base">Delivery Timeline</CardTitle></CardHeader><CardContent><OrderTimeline currentStatus={order.status} history={history.map((h) => ({ previous_status: h.previous_status, new_status: h.new_status, changed_at: h.changed_at }))} /></CardContent></Card>

      {order.status === "out_for_delivery" && <Card>
        <CardHeader><CardTitle className="text-base">Driver live-location link</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Open the driver GPS page directly on the driver's phone, or copy the link to send it through WhatsApp.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={openDriverLink}><ExternalLink className="h-4 w-4" /> Open Driver GPS</Button>
            <Button variant="outline" onClick={copyDriverLink}><Copy className="h-4 w-4" /> Copy Driver Link</Button>
          </div>
        </CardContent>
      </Card>}

      <Card><CardHeader><CardTitle className="text-base">Customer & Order Info</CardTitle></CardHeader><CardContent className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <InfoRow label="Mobile" value={order.customer?.mobile} /><InfoRow label="Address" value={order.customer?.address || "—"} /><InfoRow label="Invoice Date" value={formatDate(order.invoice_date)} /><InfoRow label="Order Date" value={formatDate(order.order_date)} /><InfoRow label="Expected Delivery" value={formatDate(order.expected_delivery_date)} />
        {isSafeExternalUrl(order.delivery_location_url) && <a href={order.delivery_location_url ?? undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><MapPin className="h-4 w-4" />View delivery location</a>}
      </CardContent></Card>

      <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Products & Billing</CardTitle>{!editing && <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Save className="h-4 w-4" />Edit Order</Button>}</CardHeader><CardContent>
        {editing ? <div className="space-y-4">
          <ItemsEditor items={editItems} onChange={setEditItems} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Override Grand Total (optional)</Label><Input value={grandTotalOverride} onChange={(e) => setGrandTotalOverride(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Delivery Charges (₹)</Label><Input type="number" min="0" step="0.01" value={deliveryCharges} onChange={(e) => setDeliveryCharges(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-1.5"><Label>Expected Delivery Date</Label><Input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Delivery Location / Google Maps Link</Label><MapLinkInput value={customerMapLink} onChange={(link) => setCustomerMapLink(link)} shop={shop} /></div>
            <div className="space-y-1.5 sm:col-span-2 rounded-md border p-3"><div className="mb-2 flex items-center gap-2"><Navigation className="h-4 w-4 text-primary" /><Label>Delivery Partner (shown when Out for Delivery)</Label></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Partner name" /><Input value={partnerMobile} onChange={(e) => setPartnerMobile(e.target.value)} placeholder="Partner mobile (optional)" inputMode="tel" /></div><div className="mt-3 flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={useCurrentPartnerLocation}>Use this device's current location</Button><span className="text-xs text-muted-foreground">{partnerLocation ? `${partnerLocation.lat.toFixed(5)}, ${partnerLocation.lng.toFixed(5)}` : "No partner location shared yet"}</span></div></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Notes</Label><Textarea value={notes.replace(/\[\[delivery_charge=[^\]]*\]\]\n?/g, "")} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setEditing(false); load(); }}>Cancel</Button><Button onClick={handleSaveEdit} loading={saving}><Save className="h-4 w-4" />Save Changes</Button></div>
        </div> : <><div className="divide-y">{items.map((item) => <div key={item.id} className="flex items-center justify-between py-2 text-sm"><div><p className="font-medium">{item.product_name}</p><p className="text-muted-foreground">{item.quantity} {item.unit} × {formatCurrency(item.price)}</p></div><p className="font-medium">{formatCurrency(item.total)}</p></div>)}</div><div className="space-y-1 border-t pt-3 text-sm"><div className="flex items-center justify-between"><span className="text-muted-foreground">Products Subtotal</span><span>{formatCurrency(items.reduce((sum, item) => sum + Number(item.total || 0), 0))}</span></div><div className="flex items-center justify-between"><span className="text-muted-foreground">Delivery Charges</span><span>{formatCurrency(Number(extractDeliveryCharge(order.notes) || 0))}</span></div><div className="flex items-center justify-between pt-1 text-base font-semibold"><span>Grand Total</span><span>{formatCurrency(order.grand_total)}</span></div></div>{order.notes && <p className="mt-3 text-sm text-muted-foreground">Notes: {order.notes.replace(/\[\[delivery_charge=[^\]]*\]\]\n?/g, "") || "—"}</p>}</>}
      </CardContent></Card>

      {invoices.length > 0 && <Card><CardHeader><CardTitle className="text-base">Invoice / Bill</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => handleViewInvoice("view")}><Eye className="h-4 w-4" />View Invoice</Button><Button variant="outline" onClick={() => handleViewInvoice("download")}><Download className="h-4 w-4" />Download Invoice</Button></CardContent></Card>}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent><DialogHeader><DialogTitle>Delete this order?</DialogTitle><DialogDescription>This cannot be undone. The order, its items, and status history will be removed.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleDelete}>Delete Order</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={pendingStatus !== null} onOpenChange={(open) => { if (!open && !updatingStatus) setPendingStatus(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{pendingStatus === "cancelled" ? "Cancel this order?" : `Change status to ${pendingStatus ? STATUS_LABEL[pendingStatus] : ""}?`}</DialogTitle><DialogDescription>{pendingStatus === "cancelled" ? "This will mark the order as cancelled." : "Please confirm this status change. You can move back later using the Back button."}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setPendingStatus(null)} disabled={updatingStatus}>No, Keep Current Status</Button><Button variant={pendingStatus === "cancelled" ? "destructive" : "default"} onClick={() => pendingStatus && performStatusUpdate(pendingStatus)} loading={updatingStatus} disabled={!pendingStatus || updatingStatus}>Yes, Change Status</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return <div className="flex items-center justify-between sm:block"><span className="text-muted-foreground">{label}</span><span className="font-medium sm:block">{value || "—"}</span></div>;
}
