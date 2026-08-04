import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { EmptyState } from "@/components/layout/EmptyState";
import { WhatsAppPanel } from "@/components/orders/WhatsAppPanel";
import { listOrders, type OrderListRow, type OrderListFilters } from "@/services/orders";
import { getSettings } from "@/services/settings";
import { buildCallLink } from "@/services/whatsapp";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_FILTERS } from "@/constants/status";
import type { OrderStatus } from "@/types/database";

const PAGE_SIZE = 20;

export function Orders() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [dateRange, setDateRange] = useState<OrderListFilters["dateRange"]>("all");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<OrderListRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("Srimalli Food Product");
  const debouncedSearch = useDebounce(search, 350);

  useEffect(() => {
    getSettings().then((s) => setCompanyName(s.company_name)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    listOrders({ search: debouncedSearch, status, dateRange, page, pageSize: PAGE_SIZE })
      .then(({ rows, count }) => {
        setRows(rows);
        setCount(count);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, status, dateRange, page]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">{count} total</p>
        </div>
        <Button asChild>
          <Link to="/admin/orders/new">
            <Plus className="h-4 w-4" />
            Add Order
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by mobile, invoice, or tracking ID"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setStatus(f.value);
              setPage(1);
            }}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              status === f.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {(["all", "today", "week", "month"] as const).map((d) => (
          <button
            key={d}
            onClick={() => {
              setDateRange(d);
              setPage(1);
            }}
            className={`rounded-md border px-3 py-1 text-xs font-medium capitalize transition-colors ${
              dateRange === d ? "border-primary text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {d === "all" ? "All Time" : `This ${d}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-secondary" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No matching orders." description="Try a different search or filter." />
      ) : (
        <div className="space-y-2">
          {rows.map((o) => (
            <Card key={o.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <Link to={`/admin/orders/${o.id}`} className="flex-1">
                  <p className="font-medium">{o.customer?.name ?? "Unknown customer"}</p>
                  <p className="text-xs text-muted-foreground">
                    #{o.invoice_number} · {o.customer?.mobile} · {formatDate(o.order_date)} · {formatCurrency(o.grand_total)}
                  </p>
                </Link>
                <div className="flex items-center gap-2">
                  <StatusBadge status={o.status} />
                  {o.customer?.mobile && (
                    <>
                      <Button asChild variant="outline" size="icon">
                        <a href={buildCallLink(o.customer.mobile)} aria-label="Call customer">
                          <Phone className="h-4 w-4" />
                        </a>
                      </Button>
                      <WhatsAppPanel
                        mobile={o.customer.mobile}
                        customerName={o.customer.name}
                        invoiceNumber={o.invoice_number}
                        trackingId={o.tracking_id}
                        status={o.status}
                        companyName={companyName}
                      />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
