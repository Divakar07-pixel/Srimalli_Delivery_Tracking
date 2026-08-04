import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Package, PhoneCall, Search, Truck, MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicSettings, type PublicSettings } from "@/services/tracking";

export function Landing() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    getPublicSettings().then(setSettings);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/track?query=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="" className="h-9 w-9 rounded-md object-contain" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              SFP
            </div>
          )}
          <span className="font-semibold">{settings?.company_name ?? "Srimalli Food Product"}</span>
          <div className="ml-auto">
            <Link to="/admin/login">
              <Button variant="outline" size="sm">
                Admin Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Track Your Order</h1>
        <p className="mt-3 text-muted-foreground">
          Enter your mobile number or your order / invoice number to see where your order is.
        </p>

        <form onSubmit={handleSearch} className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mobile number or Invoice / Order ID"
            className="h-12 text-base"
          />
          <Button type="submit" size="lg" className="sm:w-auto">
            <Search className="h-4 w-4" />
            Track Order
          </Button>
        </form>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <h2 className="mb-6 text-center text-lg font-semibold">How Tracking Works</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HowStep icon={Package} title="Order Recorded" description="We record your order once it reaches our hub." />
          <HowStep icon={Truck} title="On Its Way" description="Our delivery person contacts you to confirm your location." />
          <HowStep icon={CheckCircle2} title="Delivered" description="Track live status right up to delivery, any time." />
        </div>
      </section>

      <section className="border-t bg-card">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-12 sm:grid-cols-3">
          <Benefit icon={Search} title="Simple Tracking" description="No account or login needed — just your mobile or invoice number." />
          <Benefit icon={MapPin} title="Real Updates" description="See exactly which stage your order is at, with timestamps." />
          <Benefit icon={PhoneCall} title="Direct Contact" description="Reach us any time about your order." />
        </div>
      </section>

      {(settings?.business_phone || settings?.business_address) && (
        <section className="mx-auto max-w-5xl px-4 py-10 text-center text-sm text-muted-foreground">
          {settings?.business_phone && <p>Contact: {settings.business_phone}</p>}
          {settings?.business_address && <p className="mt-1">{settings.business_address}</p>}
        </section>
      )}

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {settings?.company_name ?? "Srimalli Food Product"}. All rights reserved.
      </footer>
    </div>
  );
}

function HowStep({ icon: Icon, title, description }: { icon: typeof Package; title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 pt-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent">
          <Icon className="h-5 w-5 text-accent-foreground" />
        </div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function Benefit({ icon: Icon, title, description }: { icon: typeof Package; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
      <Icon className="h-5 w-5 text-primary" />
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
