import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Phone, Eye, Download, Trash2, Save, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { WhatsAppPanel } from "@/components/orders/WhatsAppPanel";
import { OrderTimeline } from "@/components/tracking/OrderTimeline";
import { ItemsEditor, blankItem } from "@/components/orders/ItemsEditor";
import {
  getOrderDetail,
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  replaceOrderItems,
  computeItemTotal,
} from "@/services/orders";
import { getAdminInvoiceSignedUrl } from "@/services/invoices";
import { getSettings } from "@/services/settings";
import { buildCallLink } from "@/services/whatsapp";
import { formatCurrency, formatDate, isSafeExternalUrl } from "@/lib/utils";
import { ACTIVE_STATUS_FLOW, STATUS_LABEL } from "@/constants/status";
import { useToast } from "@/hooks/useToast";
import type { Order, OrderItem, OrderStatusHistoryRow, Invoice, Customer } from "@/types/database";
import type { DraftOrderItem } from "@/types/order";

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

  // edit form state
  const [editItems, setEditItems] = useState<DraftOrderItem[]>([]);
  const [notes, setNotes] = useState("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [grandTotalOverride, setGrandTotalOverride] = useState("");

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
        setLocationUrl(order.delivery_location_url ?? "");
        setGrandTotalOverride(String(order.grand_total ?? ""));
        setEditItems(
          items.length
            ? items.map((i) => ({
                id: i.id,
                product_name: i.product_name,
                quantity: String(i.quantity),
                unit: i.unit,
                price: String(i.price),
              }))
            : [blankItem()]
        );
      })
      .catch((e) => toast({ title: "Couldn't load order", description: (e as Error).message, variant: "error" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    getSettings().then((s) => setCompanyName(s.company_name)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleStatusUpdate = async (status: Order["status"]) => {
    if (updatingStatus) return;
    setUpdatingStatus(true);
    try {
      await updateOrderStatus(id, status);
      toast({ title: `Marked as ${STATUS_LABEL[status]}`, variant: "success" });
      load();
    } catch (e) {
      toast({ title: "Couldn't update status", description: (e as Error).message, variant: "error" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleViewInvoice = async (mode: "view" | "download") => {
    if (!invoices[0]) return;
    try {
      const url = await getAdminInvoiceSignedUrl(invoices[0].file_path);
      if (mode === "download") {
        const a = document.createElement("a");
        a.href = url;
        a.download = invoices[0].original_filename ?? "invoice";
        a.click();
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      toast({ title: "Couldn't open invoice", description: (e as Error).message, variant: "error" });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteOrder(id);
      toast({ title: "Order deleted", variant: "success" });
      navigate("/admin/orders");
    } catch (e) {
      toast({ title: "Couldn't delete order", description: (e as Error).message, variant: "error" });
    }
  };

  const handleSaveEdit = async () => {
    if (!order) return;
    if (locationUrl.trim() && !isSafeExternalUrl(locationUrl)) {
      toast({ title: "Invalid delivery link", description: "Use a valid link starting with https://.", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      const validItems = editItems.filter((i) => i.product_name.trim());
      const computedTotal = validItems.reduce((sum, i) => sum + computeItemTotal(i.quantity, i.price), 0);
      const finalTotal = grandTotalOverride.trim() ? parseFloat(grandTotalOverride) || computedTotal : computedTotal;

      await updateOrder(order.id, {
        notes: notes.trim() || null,
        expected_delivery_date: expectedDelivery || null,
        delivery_location_url: locationUrl.trim() || null,
        grand_total: finalTotal,
      });

      await replaceOrderItems(
        order.id,
        validItems.map((i) => ({
          id: i.id,
          order_id: order.id,
          product_name: i.product_name.trim(),
          quantity: parseFloat(i.quantity || "0") || 0,
          unit: i.unit || "pcs",
          price: parseFloat(i.price || "0") || 0,
          total: computeItemTotal(i.quantity, i.price),
          created_at: "",
        }))
      );

      toast({ title: "Order updated", variant: "success" });
      setEditing(false);
      load();
    } catch (e) {
      toast({ title: "Couldn't save changes", description: (e as Error).message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !order) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const currentIndex = ACTIVE_STATUS_FLOW.indexOf(order.status);
  const nextStatus = order.status !== "cancelled" && currentIndex >= 0 && currentIndex < ACTIVE_STATUS_FLOW.length - 1
    ? ACTIVE_STATUS_FLOW[currentIndex + 1]
    : null;

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <Link to="/admin/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Link>
        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Order #{order.invoice_number} · {order.tracking_id}</p>
          <h1 className="text-xl font-semibold">{order.customer?.name}</h1>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {order.customer?.mobile && (
          <>
            <Button asChild variant="outline">
              <a href={buildCallLink(order.customer.mobile)}>
                <Phone className="h-4 w-4" />
                Call Customer
              </a>
            </Button>
            <WhatsAppPanel
              mobile={order.customer.mobile}
              customerName={order.customer.name}
              invoiceNumber={order.invoice_number}
              trackingId={order.tracking_id}
              status={order.status}
              companyName={companyName}
            />
          </>
        )}
        {nextStatus && (
          <Button onClick={() => handleStatusUpdate(nextStatus)} loading={updatingStatus} disabled={updatingStatus}>
            Mark {STATUS_LABEL[nextStatus]}
          </Button>
        )}
        {order.status !== "cancelled" && order.status !== "delivered" && (
          <Button variant="destructive" onClick={() => handleStatusUpdate("cancelled")} disabled={updatingStatus}>
            Cancel Order
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTimeline
            currentStatus={order.status}
            history={history.map((h) => ({ previous_status: h.previous_status, new_status: h.new_status, changed_at: h.changed_at }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer & Order Info</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <InfoRow label="Mobile" value={order.customer?.mobile} />
          <InfoRow label="Address" value={order.customer?.address || "—"} />
          <InfoRow label="Invoice Date" value={formatDate(order.invoice_date)} />
          <InfoRow label="Order Date" value={formatDate(order.order_date)} />
          <InfoRow label="Expected Delivery" value={formatDate(order.expected_delivery_date)} />
          {isSafeExternalUrl(order.delivery_location_url) && (
            <a
              href={order.delivery_location_url ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <MapPin className="h-4 w-4" />
              View delivery location
            </a>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Products</CardTitle>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <ItemsEditor items={editItems} onChange={setEditItems} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Override Grand Total (optional)</Label>
                  <Input value={grandTotalOverride} onChange={(e) => setGrandTotalOverride(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Expected Delivery Date</Label>
                  <Input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Delivery Location / Google Maps Link</Label>
                  <Input value={locationUrl} onChange={(e) => setLocationUrl(e.target.value)} placeholder="https://maps.google.com/..." />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} loading={saving}>
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="divide-y">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 text-sm">
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
              <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
                <span>Grand Total</span>
                <span>{formatCurrency(order.grand_total)}</span>
              </div>
              {order.notes && <p className="mt-3 text-sm text-muted-foreground">Notes: {order.notes}</p>}
            </>
          )}
        </CardContent>
      </Card>

      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice / Bill</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleViewInvoice("view")}>
              <Eye className="h-4 w-4" />
              View Invoice
            </Button>
            <Button variant="outline" onClick={() => handleViewInvoice("download")}>
              <Download className="h-4 w-4" />
              Download Invoice
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this order?</DialogTitle>
            <DialogDescription>This cannot be undone. The order, its items, and status history will be removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between sm:block">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium sm:block">{value || "—"}</span>
    </div>
  );
}
