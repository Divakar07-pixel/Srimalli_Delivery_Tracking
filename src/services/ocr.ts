import { supabase } from "@/lib/supabase";

/**
 * Bill scanning / OCR architecture.
 *
 * IMPORTANT: this is intentionally an optional enhancement layer, never a
 * blocker. Every field below can come back empty, and the admin can always
 * bypass this entirely with "Enter Manually". See ADMIN WORKFLOW in the
 * README for the full state machine.
 *
 * To wire up a real OCR provider (Google Vision, AWS Textract, an LLM
 * vision call, etc.), implement `runOcr` below — call your provider from a
 * Supabase Edge Function (keep API keys server-side) and parse its response
 * into `ExtractedBillData`. If the optional Edge Function has not been
 * deployed, this still fails gracefully and manual entry remains available.
 */

export interface ExtractedBillData {
  customerName?: string;
  mobile?: string;
  invoiceNumber?: string;
  invoiceDate?: string; // yyyy-mm-dd
  address?: string;
  items?: { productName?: string; quantity?: string; unit?: string; price?: string }[];
  grandTotal?: string;
}

export type OcrOutcome =
  | { status: "success"; data: ExtractedBillData }
  | { status: "partial"; data: ExtractedBillData }
  | { status: "failed" }
  | { status: "timeout" };

const OCR_TIMEOUT_MS = 12000;

/**
 * Attempts to scan a bill image/PDF and extract structured fields.
 * Always resolves (never rejects) so callers can render a graceful outcome
 * screen instead of a stuck spinner or a crash.
 */
export async function scanBill(file: File): Promise<OcrOutcome> {
  const timeout = new Promise<OcrOutcome>((resolve) =>
    setTimeout(() => resolve({ status: "timeout" }), OCR_TIMEOUT_MS)
  );

  const attempt = runOcr(file).catch(() => ({ status: "failed" as const }));

  return Promise.race([attempt, timeout]);
}

async function runOcr(file: File): Promise<OcrOutcome> {
  const formData = new FormData();
  formData.append("bill", file, file.name);
  const { data, error } = await supabase.functions.invoke("scan-bill", { body: formData });
  if (error || !data || typeof data !== "object") return { status: "failed" };

  const extracted = data as ExtractedBillData;
  const fieldCount = [
    extracted.customerName,
    extracted.mobile,
    extracted.invoiceNumber,
    extracted.invoiceDate,
    extracted.address,
    extracted.grandTotal,
    extracted.items?.length,
  ].filter(Boolean).length;
  if (fieldCount === 0) return { status: "failed" };
  return { status: fieldCount >= 5 ? "success" : "partial", data: extracted };
}

/** Returns true if the outcome carries at least one usable field. */
export function hasUsableData(outcome: OcrOutcome): outcome is { status: "success" | "partial"; data: ExtractedBillData } {
  return outcome.status === "success" || outcome.status === "partial";
}
