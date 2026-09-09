import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, MapPin, Package, PhoneCall, Search, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPublicSettings, type PublicSettings } from "@/services/tracking";

const STEPS = [
  { icon: Package, title: "Arrived at Hub", text: "Your order has reached our delivery hub." },
  { icon: Truck, title: "Out for Delivery", text: "Our delivery person is on the way to you." },
  { icon: CheckCircle2, title: "Delivered", text: "Your order has reached its destination." },
];

export function Landing() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    getPublicSettings().then(setSettings).catch(() => {});
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/track?query=${encodeURIComponent(query.trim())}`);
  };

  const companyName = settings?.company_name ?? "Srimalli Food Product";

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="" className="h-10 w-10 rounded-xl object-contain" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm">SFP</div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{companyName}</p>
            <p className="hidden text-[11px] text-muted-foreground sm:block">Delivery Tracking</p>
          </div>
          <Link to="/admin/login" className="ml-auto">
            <Button variant="ghost" size="sm">Admin Login</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="relative border-b">
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Simple, secure order tracking
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
                Know where your order is.
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Track your delivery from our hub to your doorstep using your mobile number or order / invoice reference.
              </p>

              <form onSubmit={handleSearch} className="mx-auto mt-8 flex max-w-xl flex-col gap-2 rounded-2xl border bg-card p-2 shadow-lg sm:flex-row">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Mobile number or Order / Invoice ID"
                  className="h-12 border-0 bg-transparent px-4 text-base shadow-none focus-visible:ring-0"
                  aria-label="Mobile number or order reference"
                />
                <Button type="submit" size="lg" className="h-12 px-6">
                  <Search className="h-4 w-4" />
                  Track Order
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> No customer account needed</span>
                <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" /> Live delivery updates</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Your delivery journey</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Three clear stages</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">We keep the tracking experience focused on the actual delivery process.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="group relative rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="text-4xl font-bold text-muted-foreground/15">0{index + 1}</span>
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y bg-card">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
            <Benefit icon={Search} title="Easy to find" text="Use your mobile number or order / invoice reference." />
            <Benefit icon={MapPin} title="Clear status" text="See the current delivery stage and timestamps." />
            <Benefit icon={PhoneCall} title="Need help?" text={settings?.business_phone ? `Contact us at ${settings.business_phone}.` : "Contact the business directly for delivery support."} />
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} {companyName}. All rights reserved.
      </footer>
    </div>
  );
}

function Benefit({ icon: Icon, title, text }: { icon: typeof Search; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
