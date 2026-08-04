import { supabase } from "@/lib/supabase";
import type { Settings } from "@/types/database";

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error || !data) throw new Error("Unable to load settings.");
  return data as Settings;
}

export async function updateSettings(patch: Partial<Settings>) {
  const { error } = await supabase.from("settings").update(patch).eq("id", 1);
  if (error) throw new Error("Unable to save settings. Please try again.");
}

export async function uploadLogo(file: File): Promise<string> {
  const path = `logo-${Date.now()}.${file.name.split(".").pop()}`;
  const { error: uploadError } = await supabase.storage.from("branding").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) throw new Error("Unable to upload logo. Please try again.");

  const { data } = supabase.storage.from("branding").getPublicUrl(path);
  await updateSettings({ logo_url: data.publicUrl });
  return data.publicUrl;
}
