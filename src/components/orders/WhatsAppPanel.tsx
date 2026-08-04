import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { buildWhatsAppMessage, openWhatsApp } from "@/services/whatsapp";
import type { OrderStatus } from "@/types/database";

interface Props {
  mobile: string;
  customerName: string;
  invoiceNumber: string;
  trackingId: string;
  status: OrderStatus;
  companyName: string;
}

export function WhatsAppPanel({ mobile, customerName, invoiceNumber, trackingId, status, companyName }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const openPreview = () => {
    setMessage(buildWhatsAppMessage(status, { customerName, invoiceNumber, trackingId, companyName }));
    setOpen(true);
  };

  return (
    <>
      <Button variant="success" size="sm" onClick={openPreview}>
        <MessageCircle className="h-4 w-4" />
        WhatsApp Customer
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message Customer</DialogTitle>
            <DialogDescription>Edit the message before sending — nothing is sent automatically.</DialogDescription>
          </DialogHeader>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={10} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                openWhatsApp(mobile, message);
                setOpen(false);
              }}
            >
              Open WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
