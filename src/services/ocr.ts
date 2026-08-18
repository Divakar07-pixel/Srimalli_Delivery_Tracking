import { supabase } from "@/lib/supabase";

export interface ExtractedBillData {
  sellerName?: string;
  sellerAddress?: string;
  sellerGstin?: string;
  sellerMobile?: string;
  sellerEmail?: string;
  customerName?: string;
  mobile?: string;
  invoiceNumber?: string;
  invoiceDate?: string; // yyyy-mm-dd
  address?: string;
  items?: { productName?: string; quantity?: string; unit?: string; price?: string; amount?: string }[];
  grossAmount?: string;
  gstPercent?: string;
  gstAmount?: string;
  grandTotal?: string;
  amountInWords?: string;
}

export type OcrOutcome =
  | { status: "success"; data: ExtractedBillData }
  | { status: "partial"; data: ExtractedBillData }
  | { status: "failed"; error?: string }
  | { status: "timeout" };

const OCR_TIMEOUT_MS = 30000;

export async function scanBill(file: File): Promise<OcrOutcome> {
  const timeout = new Promise<OcrOutcome>((resolve) => setTimeout(() => resolve({ status: "timeout" }), OCR_TIMEOUT_MS));
  const attempt = runOcr(file).catch((error) => ({ status: "failed" as const, error: error instanceof Error ? error.message : undefined }));
  return Promise.race([attempt, timeout]);
}

async function runOcr(file: File): Promise<OcrOutcome> {
  const formData = new FormData();
  formData.append("bill", file, file.name);
  const { data, error } = await supabase.functions.invoke("scan-bill", { body: formData });
  if (error) return { status: "failed", error: error.message };
  if (!data || typeof data !== "object") return { status: "failed", error: "OCR returned no data." };

  const extracted = data as ExtractedBillData & { error?: string };
  if (extracted.error) return { status: "failed", error: extracted.error };

  const fieldCount = [
    extracted.customerName,
    extracted.mobile,
    extracted.invoiceNumber,
    extracted.invoiceDate,
    extracted.address,
    extracted.grandTotal,
    extracted.items?.length,
  ].filter(Boolean).length;
  if (fieldCount === 0) return { status: "failed", error: "No usable bill details were detected." };
  return { status: fieldCount >= 5 ? "success" : "partial", data: extracted };
}

export function hasUsableData(outcome: OcrOutcome): outcome is { status: "success" | "partial"; data: ExtractedBillData } {
  return outcome.status === "success" || outcome.status === "partial";
}
