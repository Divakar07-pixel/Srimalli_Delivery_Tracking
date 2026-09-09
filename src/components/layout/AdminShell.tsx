import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, LogOut, Package, PlusCircle, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/services/auth";
import { getSettings } from "@/services/settings";
import { useToast } from "@/hooks/useToast";
import { AdminLiveDeliveryMap } from "@/components/map/AdminLiveDeliveryMap";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: Package },
  { to: "/admin/orders/new", label: "Add Order", icon: PlusCircle },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell() {
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("Srimalli Admin");
  const [logoUrl, setLogoUrl] = useState(`${import.meta.env.BASE_URL}icons/icon-192.png`);

  useEffect(() => {
    getSettings().then((settings) => {
      setCompanyName(settings.company_name || "Srimalli Admin");
      setLogoUrl(settings.logo_url || `${import.meta.env.BASE_URL}icons/icon-192.png`);
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      window.location.replace(`${import.meta.env.BASE_URL}admin/login`);
    } catch (e) {
      toast({ title: "Sign out failed", description: (e as Error).message, variant: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-card/95 md:flex">
        <div className="flex h-[72px] items-center gap-3 border-b px-5">
          <img
            src={logoUrl}
            alt={companyName}
            className="h-10 w-10 rounded-xl object-contain ring-1 ring-border"
            onError={(e) => { e.currentTarget.src = `${import.meta.env.BASE_URL}icons/icon-192.png`; }}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{companyName}</p>
            <p className="text-[11px] text-muted-foreground">Delivery Operations</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 p-3">
          <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Workspace</p>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Log out
          </button>
        </div>
      </aside>

      <div className="md:pl-64">
        <main className="mx-auto max-w-7xl space-y-5 px-4 pb-24 pt-5 sm:px-6 md:pb-10 md:pt-7">
          <Outlet />
          <AdminLiveDeliveryMap />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 backdrop-blur md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
        <button onClick={handleLogout} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
          <LogOut className="h-5 w-5" />
          Log out
        </button>
      </nav>
    </div>
  );
}
