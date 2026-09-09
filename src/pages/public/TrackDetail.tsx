import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Download, Eye, FileText, MapPin, Navigation, Package, Store, Truck } from "lucide-react";
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
    if (detail?.status === "out_for_delivery" || detail?.status === "delivered") {
      return getDeliveryPartnerLocation(reference).then(acceptPartner);
    }
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

  const openInvoice = async (mode: "view" | "download") => {
    try {
      const url = await getPublicInvoiceUrl(reference);
      if (mode === "download") {
        const a = document.createElement("a");
        a.href = url;
        a.download = "";
        a.click();
      } else window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({ title: "Couldn't open invoice", description: (e as Error).message, variant: "error" });
    }
  };

  const shop = settings?.shop_latitude != null && settings.shop_longitude != null ? { lat: settings.shop_latitude, lng: settings.shop_longitude } : null;
  const hubMapsUrl = shop ? `https://www.google.com/maps?q=${shop.lat},${shop.lng}` : null;
  const customer = order?.customer_latitude != null && order.customer_longitude != null
    ? { lat: order.customer_latitude, lng: order.customer_longitude }
    : null;
  const driver = partner?.latitude != null && partner.longitude != null ? { lat: partner.latitude, lng: partner.longitude } : null;
  const liveDriver = partner?.active === true ? driver : null;
  const distance = useMemo(
    () => liveDriver && customer ? haversineKm(liveDriver, customer) : null,
    [liveDriver?.lat, liveDriver?.lng, customer?.lat, customer?.lng]
  );
  const eta = distance != null ? estimateMinutes(distance) : null;
  const deliveryCharge = parseDeliveryCharge(order?.notes);
  const lastUpdated = partner?.updated_at ? formatAge(partner.updated_at) : null;

  if (order === undefined) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  if (order === null) {
    return <div className="mx-auto max-w-2xl px-4 py-16"><EmptyState title={error ? "We couldn't load this order." : "No matching orders."} description={error ? "Check your connection and try again." : "This tracking reference may be incorrect."} action={error ? <Button onClick={() => window.location.reload()}>Try again</Button> : undefined} /></div>;
  }

  const mapDriver = liveDriver;
  const hasMapPoint = Boolean(shop || customer || mapDriver || order.customer_map_link || order.delivery_location_url);
  const currentStatusText =
    order.status === "arrived_at_hub" ? "Your order has arrived at our hub." :
    order.status === "out_for_delivery" ? "Your order is on its way to you." :
    order.status === "delivered" ? "Your order has been delivered." :
    order.status === "cancelled" ? "This order has been cancelled." :
    "Your order is being prepared.";

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Link to="/track" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to search
        </Link>

        <section className="mb-5 overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="border-b p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Order tracking</p>
                <h1 className="mt-1 truncate text-2xl font-bold tracking-tight">#{order.invoice_number}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{order.customer_name}</p>
              </div>
              <StatusBadge status={order.status} className="self-start px-3 py-1.5" />
            </div>
            <div className="mt-5 rounded-2xl bg-accent/60 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {order.status === "delivered" ? <CheckCircle2 className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-semibold">{currentStatusText}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Follow the delivery journey below for the latest recorded status.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-5 sm:p-6">
            <OrderTimeline currentStatus={order.status} history={order.timeline} />
          </div>
        </section>

        {order.status === "out_for_delivery" && (
          <Card className="mb-5 overflow-hidden rounded-3xl border shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base"><Navigation className="h-4 w-4 text-primary" /> Live delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              {hasMapPoint ? <DeliveryRouteMap shop={shop} customer={customer} customerMapUrl={order.customer_map_link || order.delivery_location_url} driver={mapDriver} height={330} onRefresh={refresh} /> : <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">The live route will appear once a valid delivery location is saved.</div>}
              <div className="rounded-2xl border bg-background p-4">
                {liveDriver && distance != null ? (
                  <div className="space-y-1">
                    <p className="font-semibold">Driver is {formatDistanceKm(distance)} away</p>
                    {eta != null && <p className="text-sm text-muted-foreground">Estimated arrival: {eta} min</p>}
                    {lastUpdated && <p className="text-xs text-muted-foreground">Location updated {lastUpdated}</p>}
                    {partner?.accuracy_m != null && partner.accuracy_m > 50 && <p className="text-xs text-warning">GPS accuracy is currently about ±{Math.round(partner.accuracy_m)} m.</p>}
                  </div>
                ) : <p className="text-sm text-muted-foreground">Driver location sharing is currently off. Live driver location is hidden.</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {order.status !== "out_for_delivery" && (hasMapPoint || hubMapsUrl) && (
          <Card className="mb-5 rounded-3xl shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" /> Locations</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {isSafeExternalUrl(order.delivery_location_url) && <a href={order.delivery_location_url ?? undefined} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium transition-colors hover:bg-secondary">Delivery location <MapPin className="h-4 w-4" /></a>}
              {hubMapsUrl && <a href={hubMapsUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium transition-colors hover:bg-secondary">Our hub location <Store className="h-4 w-4" /></a>}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Card className="rounded-3xl shadow-sm">
            <CardHeader><CardTitle className="text-base">Order details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Customer" value={order.customer_name} />
              <Row label="Mobile" value={order.masked_mobile} />
              <Row label="Invoice Date" value={formatDate(order.invoice_date)} />
              <Row label="Order Date" value={formatDate(order.order_date)} />
              <Row label="Expected Delivery" value={formatDate(order.expected_delivery_date)} />
              {deliveryCharge > 0 && <Row label="Delivery Charges" value={formatCurrency(deliveryCharge)} />}
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4 text-primary" /> Items</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {order.items.length === 0 ? <p className="text-sm text-muted-foreground">No items on file.</p> : order.items.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <div><p className="text-sm font-medium">{item.product_name}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.quantity} {item.unit} × {formatCurrency(item.price)}</p></div>
                  <p className="text-sm font-semibold">{formatCurrency(item.total)}</p>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-3 text-base font-bold"><span>Grand Total</span><span>{formatCurrency(order.grand_total)}</span></div>
            </CardContent>
          </Card>
        </div>

        {order.has_invoice && (
          <Card className="mt-5 rounded-3xl shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> Invoice / Bill</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => openInvoice("view")}><Eye className="h-4 w-4" /> View Invoice</Button>
              <Button variant="outline" onClick={() => openInvoice("download")}><Download className="h-4 w-4" /> Download Invoice</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function parseDeliveryCharge(notes?: string | null) {
  if (!notes) return 0;
  const match = notes.match(/\[\[delivery_charge=([0-9]+(?:\.[0-9]+)?)\]\]/);
  const n = match ? Number(match[1]) : 0;
  return Number.isFinite(n) ? n : 0;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>;
}

function formatAge(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}
