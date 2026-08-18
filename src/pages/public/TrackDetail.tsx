import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText, Download, Eye, MapPin, Navigation, Clock, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/EmptyState";
import { OrderTimeline } from "@/components/tracking/OrderTimeline";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { getDeliveryPartnerLocation, getOrderTracking, getPublicSettings, subscribeToDeliveryLocation, type DeliveryPartnerLocation, type PublicSettings } from "@/services/tracking";
import { DeliveryRouteMap } from "@/components/map/DeliveryRouteMap";
import { getPublicInvoiceUrl } from "@/services/invoices";
import { formatCurrency, formatDate, isSafeExternalUrl } from "@/lib/utils";
import { estimateMinutes, formatDistanceKm, haversineKm } from "@/lib/map";
import type { OrderTrackingDetail } from "@/types/order";
import { useToast } from "@/hooks/useToast";

export function TrackDetail() {
  const { reference = "" } = useParams();
  const [order, setOrder] = useState<OrderTrackingDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [partner, setPartner] = useState<DeliveryPartnerLocation | null>(null);
  const [, setClock] = useState(0);
  const latestPartnerUpdatedAt = useRef(0);
  const { toast } = useToast();

  const acceptPartner = (next: DeliveryPartnerLocation | null) => {
    if (!next) { setPartner(null); return; }
    const nextTime = next.updated_at ? new Date(next.updated_at).getTime() : 0;
    if (nextTime < latestPartnerUpdatedAt.current) return;
    latestPartnerUpdatedAt.current = nextTime;
    setPartner(next);
  };

  const refresh = () => getOrderTracking(reference).then(async (detail) => {
    setOrder(detail);
    if (detail?.status === "out_for_delivery" || detail?.status === "delivered") return getDeliveryPartnerLocation(reference).then(acceptPartner);
    latestPartnerUpdatedAt.current = 0;
    setPartner(null);
    return undefined;
  });

  useEffect(() => {
    setOrder(undefined); setError(null); latestPartnerUpdatedAt.current = 0;
    refresh().catch((err) => { setError((err as Error).message); setOrder(null); });
    getPublicSettings().then(setSettings).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock((value) => value + 1), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!order || order.status !== "out_for_delivery") return;
    const refreshLocation = () => getDeliveryPartnerLocation(reference).then(acceptPartner).catch(() => {});
    const interval = window.setInterval(refreshLocation, 2_000);
    const unsubscribe = subscribeToDeliveryLocation(order.order_id, refreshLocation);
    refreshLocation();
    return () => { window.clearInterval(interval); unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.order_id, order?.status, reference]);

  const openInvoice = async (mode: "view" | "download") => { try { const url = await getPublicInvoiceUrl(reference); if (mode === "download") { const a = document.createElement("a"); a.href = url; a.download = ""; a.click(); } else window.open(url, "_blank", "noopener,noreferrer"); } catch (e) { toast({ title: "Couldn't open invoice", description: (e as Error).message, variant: "error" }); } };
  const shop = settings?.shop_latitude != null && settings.shop_longitude != null ? { lat: settings.shop_latitude, lng: settings.shop_longitude } : null;
  const hubMapsUrl = shop ? `https://www.google.com/maps?q=${shop.lat},${shop.lng}` : null;
  const savedCustomer = order?.customer_latitude != null && order.customer_longitude != null ? { lat: order.customer_latitude, lng: order.customer_longitude } : null;
  const customer = savedCustomer; const driver = partner?.latitude != null && partner.longitude != null ? { lat: partner.latitude, lng: partner.longitude } : null; const liveDriver = partner?.active === true ? driver : null;
  const distance = useMemo(() => liveDriver && customer ? haversineKm(liveDriver, customer) : null, [liveDriver?.lat, liveDriver?.lng, customer?.lat, customer?.lng]); const eta = distance != null ? estimateMinutes(distance) : null; const lastUpdated = partner?.updated_at ? formatAge(partner.updated_at) : null;
  const deliveryCharge = parseDeliveryCharge(order?.notes);
  if (order === undefined) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (order === null) return <div className="mx-auto max-w-2xl px-4 py-16"><EmptyState title={error ? "We couldn't load this order." : "No matching orders."} description={error ? "Check your connection and try again." : "This tracking link may be incorrect."} action={error ? <Button onClick={() => window.location.reload()}>Try again</Button> : undefined} /></div>;
  const mapDriver = order.status === "out_for_delivery" || order.status === "delivered" ? driver : null; const isStopped = order.status === "out_for_delivery" && partner?.active === false && driver != null; const hasMapPoint = Boolean(shop || customer || mapDriver || order.customer_map_link || order.delivery_location_url);
  return <div className="min-h-screen bg-background pb-16"><div className="mx-auto max-w-2xl px-4 py-8">
    <Link to="/track" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to search</Link>
    <div className="mb-6 flex items-start justify-between"><div><p className="text-sm text-muted-foreground">Order #{order.invoice_number}</p><h1 className="text-xl font-semibold">{order.customer_name}</h1></div><StatusBadge status={order.status} /></div>
    <Card className="mb-4"><CardHeader><CardTitle className="text-base">Delivery Timeline</CardTitle></CardHeader><CardContent><OrderTimeline currentStatus={order.status} history={order.timeline} /></CardContent></Card>
    <Card className="mb-4"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Navigation className="h-4 w-4" /> Live delivery route</CardTitle></CardHeader><CardContent className="space-y-3">{hasMapPoint ? <DeliveryRouteMap shop={shop} customer={customer} customerMapUrl={order.customer_map_link || order.delivery_location_url} driver={mapDriver} height={320} onRefresh={refresh} /> : <p className="text-sm text-muted-foreground">The route will appear after a valid shop or delivery-home location is saved.</p>}{order.status === "out_for_delivery" && <div className="rounded-lg border p-3 text-sm">{liveDriver && distance != null ? <div className="space-y-1"><p className="font-medium">🛵 Driver is {formatDistanceKm(distance)} away</p>{eta != null && <p className="text-muted-foreground">Estimated arrival: {eta} min</p>}{lastUpdated && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Updated {lastUpdated}</p>}{partner?.accuracy_m != null && partner.accuracy_m > 50 && <p className="text-xs text-warning">Driver GPS accuracy is currently about ±{Math.round(partner.accuracy_m)} m.</p>}</div> : isStopped ? <div className="space-y-1"><p className="font-medium">Driver location sharing has stopped.</p><p className="text-xs text-muted-foreground">Showing the last known driver location for this delivery.</p></div> : <p className="text-muted-foreground">Your order is out for delivery. Live driver location will appear when tracking starts.</p>}</div>}{order.status === "delivered" && <div className="rounded-lg border p-3 text-sm"><p className="font-medium">Delivered</p>{driver && lastUpdated && <p className="mt-1 text-xs text-muted-foreground">Final driver location · {lastUpdated}</p>}</div>}</CardContent></Card>
    <Card className="mb-4"><CardHeader><CardTitle className="text-base">Billing Information</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><Row label="Customer" value={order.customer_name} /><Row label="Mobile" value={order.masked_mobile} /><Row label="Billing Address" value={order.billing_address || "—"} /><Row label="Invoice Date" value={formatDate(order.invoice_date)} /><Row label="Order Date" value={formatDate(order.order_date)} /><Row label="Expected Delivery" value={formatDate(order.expected_delivery_date)} />{deliveryCharge > 0 && <Row label="Delivery Charges" value={formatCurrency(deliveryCharge)} />}</CardContent></Card>
    {(isSafeExternalUrl(order.delivery_location_url) || hubMapsUrl) && <Card className="mb-4"><CardHeader><CardTitle className="text-base">Locations</CardTitle></CardHeader><CardContent className="space-y-4">
      {isSafeExternalUrl(order.delivery_location_url) && <div className="space-y-2"><div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /><span>Open the saved delivery location in maps.</span></div><a href={order.delivery_location_url ?? undefined} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline">Open Delivery Location</a></div>}
      {hubMapsUrl && <div className="space-y-2 border-t pt-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Store className="h-4 w-4" /><span>For direct pickup, open our hub location.</span></div><a href={hubMapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline">Open Hub Location</a></div>}
    </CardContent></Card>}
    <Card className="mb-4"><CardHeader><CardTitle className="text-base">Products</CardTitle></CardHeader><CardContent className="space-y-2">{order.items.length === 0 ? <p className="text-sm text-muted-foreground">No items on file.</p> : <div className="divide-y">{order.items.map((item, idx) => <div key={idx} className="flex items-center justify-between py-2 text-sm"><div><p className="font-medium">{item.product_name}</p><p className="text-muted-foreground">{item.quantity} {item.unit} × {formatCurrency(item.price)}</p></div><p className="font-medium">{formatCurrency(item.total)}</p></div>)}</div>}<div className="flex items-center justify-between border-t pt-3 text-base font-semibold"><span>Grand Total</span><span>{formatCurrency(order.grand_total)}</span></div></CardContent></Card>
    {order.has_invoice ? <Card><CardHeader><CardTitle className="text-base">Invoice / Bill</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => openInvoice("view")}><Eye className="h-4 w-4" /> View Invoice</Button><Button variant="outline" onClick={() => openInvoice("download")}><Download className="h-4 w-4" /> Download Invoice</Button></CardContent></Card> : <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4" /> No invoice uploaded.</div>}
  </div></div>;
}
function parseDeliveryCharge(notes?: string | null) { if (!notes) return 0; const match = notes.match(/\[\[delivery_charge=([0-9]+(?:\.[0-9]+)?)\]\]/); const n = match ? Number(match[1]) : 0; return Number.isFinite(n) ? n : 0; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>; }
function formatAge(value: string) { const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); if (seconds < 60) return `${seconds} seconds ago`; const minutes = Math.floor(seconds / 60); return `${minutes} minute${minutes === 1 ? "" : "s"} ago`; }
