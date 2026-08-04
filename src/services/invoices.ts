import { supabase } from "@/lib/supabase";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export function validateInvoiceFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Please upload a JPG, PNG, WEBP image, or a PDF.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "File is too large. Please upload a file under 15MB.";
  }
  return null;
}

/**
 * Compresses an image client-side before upload (skips PDFs). Keeps the
 * original aspect ratio, caps the longest edge at 2000px, and re-encodes as
 * JPEG at 82% quality — a good balance of legibility for OCR/manual review
 * vs. upload size on mobile data connections.
 */
export async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  const bitmap = await createImageBitmap(file);
  const maxEdge = 2000;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82)
  );
  if (!blob) return file;

  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

export async function uploadInvoiceFile(orderId: string, file: File) {
  const processed = await compressImageIfNeeded(file);
  const ext = processed.type === "application/pdf" ? "pdf" : "jpg";
  const path = `${orderId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("invoices").upload(path, processed, {
    contentType: processed.type,
    upsert: false,
  });
  if (uploadError) throw new Error("Unable to upload bill. Please try again.");

  const { error: insertError } = await supabase.from("invoices").insert({
    order_id: orderId,
    file_path: path,
    file_type: processed.type,
    original_filename: file.name,
  });
  if (insertError) throw new Error("Bill was uploaded, but couldn't be linked to the order. Please try again.");

  return path;
}

/** Admin-side signed URL — admin has an authenticated session and RLS grants direct access. */
export async function getAdminInvoiceSignedUrl(filePath: string) {
  const { data, error } = await supabase.storage.from("invoices").createSignedUrl(filePath, 300);
  if (error || !data) throw new Error("Unable to open invoice. Please try again.");
  return data.signedUrl;
}

/** Public/customer-side — goes through the get-invoice-url Edge Function. */
export async function getPublicInvoiceUrl(orderReference: string) {
  const { data, error } = await supabase.functions.invoke("get-invoice-url", {
    body: { reference: orderReference },
  });
  if (error || !data?.url) throw new Error("Unable to retrieve invoice. Please try again.");
  return data.url as string;
}
