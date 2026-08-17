import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, PlusCircle, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/services/auth";
import { getSettings } from "@/services/settings";
import { useToast } from "@/hooks/useToast";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: Package },
  { to: "/admin/orders/new", label: "Add Order", icon: PlusCircle },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("Srimalli Admin");
  const [logoUrl, setLogoUrl] = useState(`${import.meta.env.BASE_URL}icons/icon-192.png`);

  useEffect(() => {
    getSettings().then((settings) => {
      setCompanyName(settings.company_name || "Srimalli Admin");
      setLogoUrl(settings.logo_url || `${import.meta.env.BASE_URL}icons/icon-192.png`);
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    try { await signOut(); navigate("/admin/login", { replace: true }); }
    catch (e) { toast({ title: "Sign out failed", description: (e as Error).message, variant: "error" }); }
  };

  return <div className="min-h-screen bg-background">
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <img src={logoUrl} alt={companyName} className="h-9 w-9 rounded-md object-contain" onError={(e) => { e.currentTarget.src = `${import.meta.env.BASE_URL}icons/icon-192.png`; }} />
        <span className="truncate font-semibold">{companyName}</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">{NAV_ITEMS.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}><item.icon className="h-4 w-4" />{item.label}</NavLink>)}</nav>
      <div className="border-t p-3"><button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"><LogOut className="h-4 w-4" />Log out</button></div>
    </aside>
    <div className="md:pl-60"><main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-6 md:pb-10"><Outlet /></main></div>
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-card md:hidden">{NAV_ITEMS.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn("flex flex-col items-center gap-1 py-2.5 text-xs font-medium", isActive ? "text-primary" : "text-muted-foreground")}><item.icon className="h-5 w-5" />{item.label}</NavLink>)}</nav>
  </div>;
}
