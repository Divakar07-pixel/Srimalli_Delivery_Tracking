import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Navigation, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeliveryRouteMap } from "@/components/map/DeliveryRouteMap";
import { getOrderDetail } from "@/services/orders";
import { getDeliveryPartnerLocation, subscribeToDeliveryLocation } from "@/services/tracking";
import { getSettings } from "@/services/settings";
import { parseCoordinates, type LatLng } from "@/lib/map";
import type { Order, Customer } from "@/types/database";
import { useToast } from "@/hooks/useToast";

export function AdminLiveDeliveryMap() {
  const { id } = useParams();
  const { toast } = useToast();
  const [order, setOrder] = useState<(Order & { customer: Customer }) | null>(null);
  const [shop, setShop] = useState<LatLng | null>(null);
  const [driver, setDriver] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const latestUpdatedAt = useRef(0);

  const applyDriverLocation = (location: Awaited<ReturnType<typeof getDeliveryPartnerLocation>>) => {
    if (!location) return;
    const updatedAt = location.updated_at ? new Date(location.updated_at).getTime() : 0;
    if (updatedAt < latestUpdatedAt.current) return;
    latestUpdatedAt.current = updatedAt;
    setDriver(location.latitude != null && location.longitude != null ? { lat: location.latitude, lng: location.longitude } : null);
  };

  const load = async () => {
    if (!id) return;
    try {
      const [{ order: loadedOrder }, settings] = await Promise.all([getOrderDetail(id), getSettings()]);
      setOrder(loadedOrder as Order & { customer: Customer });
      if (settings.shop_latitude != null && settings.shop_longitude != null) setShop({ lat: settings.shop_latitude, lng: settings.shop_longitude });
      if (loadedOrder.tracking_id && (loadedOrder.status === "out_for_delivery" || loadedOrder.status === "delivered")) {
        const location = await getDeliveryPartnerLocation(loadedOrder.tracking_id);
        applyDriverLocation(location);
      } else { latestUpdatedAt.current = 0; setDriver(null); }
    } catch (error) {
      toast({ title: "Couldn't load live delivery map", description: (error as Error).message, variant: "error" });
    } finally { setLoading(false); }
  };

  useEffect(() => { latestUpdatedAt.current = 0; void load(); }, [id]);

  useEffect(() => {
    if (!order?.tracking_id || order.status !== "out_for_delivery") return;
    const refreshLocation = () => getDeliveryPartnerLocation(order.tracking_id).then(applyDriverLocation).catch(() => {});
    const interval = window.setInterval(refreshLocation, 2_000);
    const unsubscribe = subscribeToDeliveryLocation(order.id, refreshLocation);
    refreshLocation();
    return () => { window.clearInterval(interval); unsubscribe(); };
  }, [order?.id, order?.tracking_id, order?.status]);

  if (!id || loading || !order) return null;
  const customer = order.customer_latitude != null && order.customer_longitude != null ? { lat: order.customer_latitude, lng: order.customer_longitude } : null;
  const parsedCustomer = customer || parseCoordinates(order.customer_map_link || order.delivery_location_url || "");
  const hasPoint = Boolean(shop || parsedCustomer || driver);
  if (!hasPoint) return null;

  return <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0">
      <CardTitle className="flex items-center gap-2 text-base"><Navigation className="h-4 w-4" /> Live delivery route</CardTitle>
      <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh</Button>
    </CardHeader>
    <CardContent>
      <DeliveryRouteMap shop={shop} customer={parsedCustomer} customerMapUrl={order.customer_map_link || order.delivery_location_url} driver={driver} height={360} onRefresh={load} />
    </CardContent>
  </Card>;
}
