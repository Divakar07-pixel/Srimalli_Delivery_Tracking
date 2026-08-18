import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type ExtractedItem = {
  productName?: string;
  quantity?: string;
  unit?: string;
  price?: string;
  amount?: string;
};

type ExtractedBillData = {
  sellerName?: string;
  sellerAddress?: string;
  sellerGstin?: string;
  sellerMobile?: string;
  sellerEmail?: string;
  customerName?: string;
  mobile?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  address?: string;
  items?: ExtractedItem[];
  grossAmount?: string;
  gstPercent?: string;
  gstAmount?: string;
  grandTotal?: string;
  amountInWords?: string;
};

const jsonHeaders = { "Content-Type": "application/json" };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, "Connection": "keep-alive" } });
}

function extractJson(text: string): ExtractedBillData | null {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(cleaned) as ExtractedBillData; } catch { /* try the first JSON object */ }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)) as ExtractedBillData; } catch { return null; }
}

function normalize(data: ExtractedBillData): ExtractedBillData {
  return {
    ...data,
    customerName: data.customerName?.trim() || undefined,
    mobile: data.mobile?.replace(/\D/g, "").slice(-10) || undefined,
    invoiceNumber: data.invoiceNumber?.trim() || undefined,
    invoiceDate: data.invoiceDate?.trim() || undefined,
    address: data.address?.trim() || undefined,
    grandTotal: data.grandTotal?.trim() || data.grossAmount?.trim() || undefined,
    items: (data.items ?? []).filter((item) => item.productName?.trim()).map((item) => ({
      productName: item.productName?.trim(),
      quantity: item.quantity?.trim(),
      unit: item.unit?.trim(),
      price: item.price?.trim(),
      amount: item.amount?.trim(),
    })),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response({ error: "POST required" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (!apiKey) return response({ error: "OCR is not configured. Add GEMINI_API_KEY to the Supabase Edge Function secrets." }, 503);

  try {
    const form = await req.formData();
    const file = form.get("bill");
    if (!(file instanceof File)) return response({ error: "Bill file is required." }, 400);

    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
    const base64 = btoa(binary);
    const mimeType = file.type || "application/octet-stream";

    const prompt = `You are an invoice OCR parser for an Indian food-products distributor. Read the attached bill image/PDF carefully, including English/Tamil mixed text. Return ONLY valid JSON matching this schema:\n${JSON.stringify({ sellerName: "", sellerAddress: "", sellerGstin: "", sellerMobile: "", sellerEmail: "", customerName: "", mobile: "", invoiceNumber: "", invoiceDate: "yyyy-mm-dd", address: "", items: [{ productName: "", quantity: "", unit: "", price: "", amount: "" }], grossAmount: "", gstPercent: "", gstAmount: "", grandTotal: "", amountInWords: "" })}\nRules: identify the invoice/estimate number separately from phone numbers; preserve decimal quantities and prices; map UOM exactly (Can, TIN, Pet Bottle, CAN, Pcs, litre/L etc.); price is the unit rate, amount is quantity times rate; do not swap rate and amount; grandTotal is the final NET/total amount printed on the bill; do not invent missing values; return empty strings for unavailable fields. For dates, convert a printed DD-MM-YYYY or DD/MM/YYYY date to YYYY-MM-DD. Extract every product row you can read.`;

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
    });

    if (!geminiResponse.ok) {
      const detail = await geminiResponse.text();
      console.error("Gemini OCR error", detail);
      return response({ error: "The OCR provider could not process this bill." }, 502);
    }

    const payload = await geminiResponse.json();
    const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
    const parsed = extractJson(text);
    if (!parsed) return response({ error: "OCR returned unreadable structured data." }, 422);

    return response(normalize(parsed));
  } catch (error) {
    console.error("scan-bill failed", error);
    return response({ error: "Unable to scan the bill." }, 500);
  }
});
