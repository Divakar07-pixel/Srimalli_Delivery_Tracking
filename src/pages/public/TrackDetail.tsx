import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText, Download, Eye, MapPin, Navigation } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/EmptyState";
import { OrderTimeline } from "@/components/tracking/OrderTimeline";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { getDeliveryPartnerLocation, getOrderTracking, getPublicSettings, type DeliveryPartnerLocation, type PublicSettings } from "@/services/tracking";
import { DeliveryRouteMap } from "@/components/map/DeliveryRouteMap";
import { getPublicInvoiceUrl } from "@/services/invoices";
import { formatCurrency, formatDate, isSafeExternalUrl } from "@/lib/utils";
import type { OrderTrackingDetail } from "@/types/order";
import { useToast } from "@/hooks/useToast";

export function TrackDetail() {
  const { reference = "" } = useParams();
  const [order, setOrder] = useState<OrderTrackingDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [partner, setPartner] = useState<DeliveryPartnerLocation | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setOrder(undefined);
    setError(null);
    getOrderTracking(reference)
      .then((detail) => {
        setOrder(detail);
        if (detail?.status === "out_for_delivery") {
          return getDeliveryPartnerLocation(reference).then(setPartner);
        }
        setPartner(null);
        return undefined;
      })
      .catch((err) => {
        setError((err as Error).message);
        setOrder(null);
      });
  }, [reference]);

  useEffect(() => {
    getPublicSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (order?.status !== "out_for_delivery") return;
    const refresh = () => getDeliveryPartnerLocation(reference).then(setPartner).catch(() => {});
    const interval = window.setInterval(refresh, 20_000);
    return () => window.clearInterval(interval);
  }, [order?.status, reference]);

  const openInvoice = async (mode: "view" | "download") => {
    try {
      const url = await getPublicInvoiceUrl(reference);
      if (mode === "download") {
        const a = document.createElement("a");
        a.href = url;
        a.download = "";
        a.click();
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      toast({ title: "Couldn't open invoice", description: (e as Error).message, variant: "error" });
    }
  };

  if (order === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          title={error ? "We couldn't load this order." : "No matching orders."}
          description={error ? "Check your connection and try again." : "This tracking link may be incorrect."}
          action={error ? <Button onClick={() => window.location.reload()}>Try again</Button> : undefined}
        />
      </div>
    );
  }

  const shop = settings?.shop_latitude != null && settings.shop_longitude != null
    ? { lat: settings.shop_latitude, lng: settings.shop_longitude }
    : null;
  const customer = order.customer_latitude != null && order.customer_longitude != null
    ? { lat: order.customer_latitude, lng: order.customer_longitude }
    : null;
  const driver = partner?.latitude != null && partner.longitude != null
    ? { lat: partner.latitude, lng: partner.longitude }
    : null;

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/track" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to search
        </Link>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Order #{order.invoice_number}</p>
            <h1 className="text-xl font-semibold">{order.customer_name}</h1>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Delivery Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderTimeline currentStatus={order.status} history={order.timeline} />
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Navigation className="h-4 w-4" /> Shop to your home</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
        {shop && customer ? (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Navigation className="h-4 w-4" /> Delivery route</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DeliveryRouteMap shop={shop} customer={customer} driver={driver} height={320} />
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>🏪 From: Srimalli Food Product</span>
                <span>🏠 To: your delivery address</span>
              </div>
              {order.status === "out_for_delivery" && (
                <p className="text-sm text-muted-foreground">
                  {driver ? `🛵 ${partner?.name || "Your delivery partner"} is on the way. Location refreshes automatically.` : "Your order is out for delivery. The partner location will appear once it is shared."}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">The route will appear after the shop and delivery-home coordinates are saved for this order.</p>
        )}
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Invoice Date" value={formatDate(order.invoice_date)} />
            <Row label="Order Date" value={formatDate(order.order_date)} />
            <Row label="Expected Delivery" value={formatDate(order.expected_delivery_date)} />
            <Row label="Mobile" value={order.masked_mobile} />
          </CardContent>
        </Card>

        {isSafeExternalUrl(order.delivery_location_url) && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Delivery Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Open the saved delivery location in maps.</span>
              </div>
              <a
                href={order.delivery_location_url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Open Google Maps
              </a>
            </CardContent>
          </Card>
        )}

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items on file.</p>
            ) : (
              <div className="divide-y">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-muted-foreground">
                        {item.quantity} {item.unit} × {formatCurrency(item.price)}
                      </p>
                    </div>
                    <p className="font-medium">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
              <span>Grand Total</span>
              <span>{formatCurrency(order.grand_total)}</span>
            </div>
          </CardContent>
        </Card>

        {order.has_invoice && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice / Bill</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => openInvoice("view")}>
                <Eye className="h-4 w-4" />
                View Invoice
              </Button>
              <Button variant="outline" onClick={() => openInvoice("download")}>
                <Download className="h-4 w-4" />
                Download Invoice
              </Button>
            </CardContent>
          </Card>
        )}

        {!order.has_invoice && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            No invoice uploaded.
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
