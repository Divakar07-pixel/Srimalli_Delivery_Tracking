import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Search, ArrowLeft, PackageX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { searchOrdersByMobile, getOrderTracking } from "@/services/tracking";
import { formatCurrency, formatDate, normalizeMobile } from "@/lib/utils";
import type { OrderSearchSummary } from "@/types/order";

function looksLikeMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 6 && digits.length === value.replace(/\s/g, "").length;
}

export function Track() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = params.get("query") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<OrderSearchSummary[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialQuery) runSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(value: string) {
    setLoading(true);
    setError(null);
    setNotFound(false);
    setResults(null);
    try {
      if (looksLikeMobile(value)) {
        const rows = await searchOrdersByMobile(normalizeMobile(value));
        if (rows.length === 1) {
          navigate(`/track/${rows[0].tracking_id}`);
          return;
        }
        setResults(rows);
        if (rows.length === 0) setNotFound(true);
      } else {
        const detail = await getOrderTracking(value.trim());
        if (detail) {
          navigate(`/track/${detail.tracking_id}`);
          return;
        }
        setNotFound(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) runSearch(query.trim());
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mobile number or Invoice / Order ID"
            className="h-11"
          />
          <Button type="submit" loading={loading}>
            <Search className="h-4 w-4" />
            Track Order
          </Button>
        </form>

        <div className="mt-8 space-y-3">
          {error && (
            <Card>
              <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
            </Card>
          )}

          {notFound && !error && (
            <EmptyState
              icon={PackageX}
              title="No matching orders."
              description="Please double-check your mobile number or invoice/order ID and try again."
            />
          )}

          {results && results.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">Found {results.length} orders for this mobile number.</p>
              {results.map((r) => (
                <Card key={r.order_id}>
                  <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">Order #{r.invoice_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(r.order_date)} · {formatCurrency(r.grand_total)}
                      </p>
                      <div className="mt-2">
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                    <Button asChild variant="outline">
                      <Link to={`/track/${r.tracking_id}`}>Track Order</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
