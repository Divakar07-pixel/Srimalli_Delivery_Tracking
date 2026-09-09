import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CheckCircle2, Clock3, Package, Plus, Truck, Warehouse, XCircle } from "lucide-react";
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

  const stats = counts
    ? [
        { label: "Total Orders", value: counts.total, icon: Package },
        { label: "Today's Orders", value: counts.today, icon: Clock3 },
        { label: "At Hub", value: counts.atHub, icon: Warehouse },
        { label: "Out for Delivery", value: counts.outForDelivery, icon: Truck },
        { label: "Delivered Today", value: counts.deliveredToday, icon: CheckCircle2 },
        { label: "Cancelled", value: counts.cancelled, icon: XCircle },
      ]
    : [];

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Operations</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">A quick view of today's delivery activity.</p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/admin/orders/new"><Plus className="h-4 w-4" /> Add Order</Link>
        </Button>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary" />)
          : stats.map((stat) => (
              <Card key={stat.label} className="rounded-2xl">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
                      <stat.icon className="h-4 w-4" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                  <p className="mt-4 text-2xl font-bold">{stat.value}</p>
                  <p className="mt-1 text-xs leading-4 text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <Card className="rounded-2xl">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-semibold">Recent Orders</h2>
              <p className="text-xs text-muted-foreground">Latest activity across your delivery workflow.</p>
            </div>
            <Link to="/admin/orders" className="text-sm font-medium text-primary hover:underline">View all</Link>
          </div>
          <CardContent className="p-0">
            {!loading && recent.length === 0 ? (
              <div className="p-5"><EmptyState title="No orders yet." description="Create your first order to get started." /></div>
            ) : (
              <div className="divide-y">
                {recent.map((order) => (
                  <Link key={order.id} to={`/admin/orders/${order.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-secondary/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{order.customer?.name ?? "Unknown customer"}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">#{order.invoice_number} · {formatDate(order.order_date)} · {formatCurrency(order.grand_total)}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Delivery Flow</h2>
            <p className="mt-1 text-xs text-muted-foreground">Your operational sequence.</p>
          </div>
          <CardContent className="p-5">
            <FlowItem icon={Warehouse} title="Arrived at Hub" value={counts?.atHub ?? 0} />
            <FlowItem icon={Truck} title="Out for Delivery" value={counts?.outForDelivery ?? 0} />
            <FlowItem icon={CheckCircle2} title="Delivered Today" value={counts?.deliveredToday ?? 0} last />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function FlowItem({ icon: Icon, title, value, last = false }: { icon: typeof Package; title: string; value: number; last?: boolean }) {
  return (
    <div className="relative flex items-center gap-3 pb-6 last:pb-0">
      {!last && <span className="absolute left-4 top-9 h-[calc(100%-14px)] w-px bg-border" />}
      <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-lg font-bold">{value}</span>
      </div>
    </div>
  );
}
