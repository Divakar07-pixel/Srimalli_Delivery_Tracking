import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Clock, Warehouse, Truck, CheckCircle2, Hourglass, XCircle, Plus, Camera, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardCounts, listOrders, type DashboardCounts, type OrderListRow } from "@/services/orders";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { EmptyState } from "@/components/layout/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";

export function Dashboard() {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [recent, setRecent] = useState<OrderListRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardCounts(), listOrders({ pageSize: 6 })])
      .then(([c, o]) => {
        setCounts(c);
        setRecent(o.rows);
      })
      .finally(() => setLoading(false));
  }, []);

  const cards = counts
    ? [
        { label: "Total Orders", value: counts.total, icon: Package },
        { label: "Today's Orders", value: counts.today, icon: Clock },
        { label: "At Hub", value: counts.atHub, icon: Warehouse },
        { label: "Out for Delivery", value: counts.outForDelivery, icon: Truck },
        { label: "Delivered", value: counts.delivered, icon: CheckCircle2 },
        { label: "Pending", value: counts.pending, icon: Hourglass },
        { label: "Cancelled", value: counts.cancelled, icon: XCircle },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your deliveries.</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Button asChild size="lg" className="h-auto flex-col gap-2 py-4">
          <Link to="/admin/orders/new">
            <Plus className="h-5 w-5" />
            Add Order
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg" className="h-auto flex-col gap-2 py-4">
          <Link to="/admin/orders/new?mode=capture">
            <Camera className="h-5 w-5" />
            Capture Bill
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg" className="h-auto flex-col gap-2 py-4">
          <Link to="/admin/orders/new?mode=manual">
            <ListChecks className="h-5 w-5" />
            Manual Entry
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-auto flex-col gap-2 py-4">
          <Link to="/admin/orders">
            <Package className="h-5 w-5" />
            View Orders
          </Link>
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-secondary" />)
          : cards.map((c) => (
              <Card key={c.label}>
                <CardContent className="flex items-center justify-between pt-5">
                  <div>
                    <p className="text-2xl font-bold">{c.value}</p>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                  </div>
                  <c.icon className="h-6 w-6 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Recent orders */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Recent Orders</h2>
          <Link to="/admin/orders" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        {!loading && recent.length === 0 ? (
          <EmptyState title="No orders yet." description="Create your first order to get started." />
        ) : (
          <div className="space-y-2">
            {recent.map((o) => (
              <Link key={o.id} to={`/admin/orders/${o.id}`}>
                <Card className="transition-colors hover:bg-secondary/50">
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">{o.customer?.name ?? "Unknown customer"}</p>
                      <p className="text-xs text-muted-foreground">
                        #{o.invoice_number} · {formatDate(o.order_date)} · {formatCurrency(o.grand_total)}
                      </p>
                    </div>
                    <StatusBadge status={o.status} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
