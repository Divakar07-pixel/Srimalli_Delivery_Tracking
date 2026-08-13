import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { getSettings, updateSettings, uploadLogo } from "@/services/settings";
import { useToast } from "@/hooks/useToast";
import { parseCoordinates } from "@/lib/map";
import { ShopPreviewMap } from "@/components/map/ShopPreviewMap";
import type { Settings as SettingsType } from "@/types/database";

const DEFAULT_ARRIVED = `Hello {CustomerName},\n\nYour order (Invoice: {InvoiceNumber}) has arrived safely at our hub.\n\nOur delivery person will contact you regarding your location and delivery. Your order is expected to be delivered today or tomorrow.\n\nTrack your order here:\n{TrackingURL}\n\nThank you for choosing\n{CompanyName}.`;
const DEFAULT_OUT = `Hello {CustomerName},\n\nGood news! Your order (Invoice: {InvoiceNumber}) is out for delivery. We expect to deliver your order today.\n\nTrack your order:\n{TrackingURL}\n\nThank you,\n{CompanyName}.`;
const DEFAULT_DELIVERED = `Hello {CustomerName},\n\nYour order (Invoice: {InvoiceNumber}) has been delivered successfully.\n\nThank you for choosing {CompanyName}. We look forward to serving you again.`;

export function AdminSettings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [shopMapLink, setShopMapLink] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((e) => toast({ title: "Couldn't load settings", description: (e as Error).message, variant: "error" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (fields: Partial<SettingsType>) => setSettings((s) => (s ? { ...s, ...fields } : s));

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateSettings({
        company_name: settings.company_name,
        business_phone: settings.business_phone,
        business_address: settings.business_address,
        whatsapp_template_arrived: settings.whatsapp_template_arrived,
        whatsapp_template_out_for_delivery: settings.whatsapp_template_out_for_delivery,
whatsapp_template_delivered: settings.whatsapp_template_delivered,
        default_expected_delivery_text: settings.default_expected_delivery_text,
        theme: settings.theme,
        shop_latitude: settings.shop_latitude,
        shop_longitude: settings.shop_longitude,
        delivery_partner_name: settings.delivery_partner_name,
        delivery_partner_mobile: settings.delivery_partner_mobile,
      });
      toast({ title: "Settings saved", variant: "success" });
    } catch (e) {
      toast({ title: "Couldn't save settings", description: (e as Error).message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadLogo(file);
      patch({ logo_url: url });
      toast({ title: "Logo updated", variant: "success" });
    } catch (e) {
      toast({ title: "Couldn't upload logo", description: (e as Error).message, variant: "error" });
    } finally {
      setUploadingLogo(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-16">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Company details, branding, and message templates.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Company logo" className="h-14 w-14 rounded-md border object-contain" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-md border bg-secondary text-xs text-muted-foreground">
                No logo
              </div>
            )}
            <div>
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-secondary">
                  <Upload className="h-4 w-4" />
                  {uploadingLogo ? "Uploading..." : "Change Logo"}
                </span>
              </Label>
              <input
                id="logo-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                disabled={uploadingLogo}
                onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Company Name</Label>
            <Input value={settings.company_name} onChange={(e) => patch({ company_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Business Phone</Label>
            <Input value={settings.business_phone ?? ""} onChange={(e) => patch({ business_phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Business Address</Label>
            <Textarea value={settings.business_address ?? ""} onChange={(e) => patch({ business_address: e.target.value })} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Default Expected Delivery Text</Label>
            <Input
              value={settings.default_expected_delivery_text ?? ""}
              onChange={(e) => patch({ default_expected_delivery_text: e.target.value })}
              placeholder="within 1-2 days of arrival at hub"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shop Location (Srimalli Food Product)</CardTitle>
          <CardDescription>
            Set the shop's pin so the tracking page can show the route from your shop to the customer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Shop Latitude</Label>
              <Input
                type="number"
                step="any"
                value={settings.shop_latitude ?? ""}
                onChange={(e) => patch({ shop_latitude: e.target.value === "" ? null : parseFloat(e.target.value) })}
                placeholder="e.g. 12.9716"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Shop Longitude</Label>
              <Input
                type="number"
                step="any"
                value={settings.shop_longitude ?? ""}
                onChange={(e) => patch({ shop_longitude: e.target.value === "" ? null : parseFloat(e.target.value) })}
                placeholder="e.g. 77.5946"
              />
            </div>
          </div>
          {settings.shop_latitude != null && settings.shop_longitude != null && (
            <div className="overflow-hidden rounded-md border" style={{ height: 220 }}>
              <ShopPreviewMap lat={settings.shop_latitude} lng={settings.shop_longitude} />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Tip: Paste your Google Maps share link into the "Google Maps link" box below and click "Extract".
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={shopMapLink} onChange={(e) => setShopMapLink(e.target.value)} placeholder="Full Google Maps URL or latitude,longitude" />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const coords = parseCoordinates(shopMapLink);
                if (coords) {
                  patch({ shop_latitude: coords.lat, shop_longitude: coords.lng });
                  toast({ title: "Shop coordinates extracted", variant: "success" });
                } else {
                  toast({ title: "Coordinates not found", description: "Use a full Maps URL with coordinates, or paste latitude,longitude. Short maps.app.goo.gl links hide coordinates.", variant: "error" });
                }
              }}
            >
              Extract Coordinates
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Single Delivery Partner</CardTitle>
          <CardDescription>Saved once and assigned automatically to every delivery.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Partner Name</Label><Input value={settings.delivery_partner_name ?? ""} onChange={(e) => patch({ delivery_partner_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Partner Mobile</Label><Input value={settings.delivery_partner_mobile ?? ""} onChange={(e) => patch({ delivery_partner_mobile: e.target.value })} inputMode="tel" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">WhatsApp Message Templates</CardTitle>
          <CardDescription>
            Use placeholders: {"{CustomerName}"}, {"{InvoiceNumber}"}, {"{TrackingURL}"}, {"{CompanyName}"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Arrived at Hub</Label>
            <Textarea
              value={settings.whatsapp_template_arrived ?? DEFAULT_ARRIVED}
              onChange={(e) => patch({ whatsapp_template_arrived: e.target.value })}
              rows={5}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Out for Delivery</Label>
            <Textarea
              value={settings.whatsapp_template_out_for_delivery ?? DEFAULT_OUT}
              onChange={(e) => patch({ whatsapp_template_out_for_delivery: e.target.value })}
              rows={5}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Delivered</Label>
            <Textarea
              value={settings.whatsapp_template_delivered ?? DEFAULT_DELIVERED}
              onChange={(e) => patch({ whatsapp_template_delivered: e.target.value })}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Theme</Label>
            <Select value={settings.theme} onValueChange={(v) => patch({ theme: v })}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} loading={saving} size="lg" className="w-full sm:w-auto">
        Save Settings
      </Button>
    </div>
  );
}
