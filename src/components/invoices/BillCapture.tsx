import { useRef, useState } from "react";
import { Camera, ImagePlus, FileText, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { validateInvoiceFile } from "@/services/invoices";
import { scanBill, hasUsableData, type ExtractedBillData } from "@/services/ocr";
import { useToast } from "@/hooks/useToast";

type FlowState =
  | { step: "idle" }
  | { step: "scanning"; file: File }
  | { step: "timeout"; file: File }
  | { step: "failed"; file: File; error?: string }
  | { step: "review"; file: File; data: ExtractedBillData; partial: boolean };

interface Props { onProceed: (file: File | null, data: ExtractedBillData | null) => void; }

export function BillCapture({ onProceed }: Props) {
  const [state, setState] = useState<FlowState>({ step: "idle" });
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    const error = validateInvoiceFile(file);
    if (error) { toast({ title: "Can't use this file", description: error, variant: "error" }); return; }
    setState({ step: "scanning", file });
    const outcome = await scanBill(file);
    if (outcome.status === "timeout") setState({ step: "timeout", file });
    else if (outcome.status === "failed") setState({ step: "failed", file, error: outcome.error });
    else if (hasUsableData(outcome)) {
      const fieldCount = Object.values(outcome.data).filter(Boolean).length;
      setState({ step: "review", file, data: outcome.data, partial: outcome.status === "partial" || fieldCount < 5 });
    }
  };

  const retry = () => { if (state.step === "timeout" || state.step === "failed") handleFile(state.file); };

  if (state.step === "idle") return <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
    <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
    <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
    <button onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-primary hover:bg-accent"><Camera className="h-7 w-7 text-primary" /><span className="text-sm font-medium">Take Photo</span></button>
    <button onClick={() => galleryRef.current?.click()} className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-primary hover:bg-accent"><ImagePlus className="h-7 w-7 text-primary" /><span className="text-sm font-medium">Choose from Gallery</span></button>
    <button onClick={() => pdfRef.current?.click()} className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-primary hover:bg-accent"><FileText className="h-7 w-7 text-primary" /><span className="text-sm font-medium">Upload PDF</span></button>
  </div>;

  if (state.step === "scanning") return <Card><CardContent className="flex flex-col items-center gap-4 py-10 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /><div><p className="font-medium">Scanning Bill...</p><p className="text-sm text-muted-foreground">Reading customer, invoice, products, quantities, UOM, rates and totals.</p></div><Button variant="outline" onClick={() => onProceed(state.file, null)}>Enter Details Manually</Button></CardContent></Card>;

  if (state.step === "timeout") return <Card><CardContent className="flex flex-col items-center gap-4 py-10 text-center"><AlertTriangle className="h-8 w-8 text-warning" /><div><p className="font-medium">Bill scanning is taking longer than expected.</p><p className="text-sm text-muted-foreground">Your uploaded bill is ready to attach to the order.</p></div><div className="flex gap-2"><Button variant="outline" onClick={retry}>Try Again</Button><Button onClick={() => onProceed(state.file, null)}>Continue Manually</Button></div></CardContent></Card>;

  if (state.step === "failed") return <Card><CardContent className="flex flex-col items-center gap-4 py-10 text-center"><AlertTriangle className="h-8 w-8 text-muted-foreground" /><div><p className="font-medium">We couldn't read this bill.</p><p className="text-sm text-muted-foreground">{state.error || "You can keep the bill attached and enter the details manually."}</p></div><div className="flex gap-2"><Button variant="outline" onClick={retry}>Try Again</Button><Button onClick={() => onProceed(state.file, null)}>Enter Details Manually</Button></div></CardContent></Card>;

  if (state.step === "review") return <ReviewScreen file={state.file} data={state.data} partial={state.partial} onConfirm={onProceed} />;
  return null;
}

function ReviewScreen({ file, data, partial, onConfirm }: { file: File; data: ExtractedBillData; partial: boolean; onConfirm: (file: File | null, data: ExtractedBillData | null) => void; }) {
  const [edited, setEdited] = useState<ExtractedBillData>(data);
  const updateItem = (index: number, patch: Partial<NonNullable<ExtractedBillData["items"]>[number]>) => setEdited((current) => ({ ...current, items: (current.items ?? []).map((item, i) => i === index ? { ...item, ...patch } : item) }));

  return <Card><CardContent className="space-y-4 pt-5">
    <div><p className="font-medium">Review Bill Details</p><p className="text-sm text-muted-foreground">{partial ? "Some details were detected. Check and correct anything before continuing." : "Check the OCR results before they are placed into the order form."}</p></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Customer Name" value={edited.customerName} onChange={(v) => setEdited({ ...edited, customerName: v })} />
      <Field label="Mobile Number" value={edited.mobile} onChange={(v) => setEdited({ ...edited, mobile: v })} />
      <Field label="Invoice / Estimate Number" value={edited.invoiceNumber} onChange={(v) => setEdited({ ...edited, invoiceNumber: v })} />
      <Field label="Invoice Date" type="date" value={edited.invoiceDate} onChange={(v) => setEdited({ ...edited, invoiceDate: v })} />
      <Field label="Address" value={edited.address} onChange={(v) => setEdited({ ...edited, address: v })} />
      <Field label="Final / Net Total" value={edited.grandTotal} onChange={(v) => setEdited({ ...edited, grandTotal: v })} />
    </div>

    <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 text-sm sm:grid-cols-3">
      <Field label="Gross Amount" value={edited.grossAmount} onChange={(v) => setEdited({ ...edited, grossAmount: v })} />
      <Field label="GST %" value={edited.gstPercent} onChange={(v) => setEdited({ ...edited, gstPercent: v })} />
      <Field label="GST Amount" value={edited.gstAmount} onChange={(v) => setEdited({ ...edited, gstAmount: v })} />
    </div>

    <div className="space-y-2"><p className="font-medium">Products detected</p>{(edited.items ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No product rows detected. They can be entered after continuing.</p> : <div className="space-y-3">{edited.items?.map((item, index) => <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[2fr_0.7fr_0.8fr_1fr_1fr]">
      <Field label="Product" value={item.productName} onChange={(v) => updateItem(index, { productName: v })} />
      <Field label="Qty" value={item.quantity} onChange={(v) => updateItem(index, { quantity: v })} />
      <Field label="UOM" value={item.unit} onChange={(v) => updateItem(index, { unit: v })} />
      <Field label="Rate" value={item.price} onChange={(v) => updateItem(index, { price: v })} />
      <Field label="Amount" value={item.amount} onChange={(v) => updateItem(index, { amount: v })} />
    </div>)}</div>}</div>

    {edited.amountInWords && <p className="text-xs text-muted-foreground">Amount in words: {edited.amountInWords}</p>}
    <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => onConfirm(file, null)}>Enter Manually Instead</Button><Button onClick={() => onConfirm(file, edited)}>Use These Details</Button></div>
  </CardContent></Card>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value?: string; onChange: (v: string) => void; type?: string; }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Not detected — enter manually" /></div>;
}
