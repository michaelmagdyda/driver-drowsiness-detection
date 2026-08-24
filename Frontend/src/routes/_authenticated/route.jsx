import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Eye,
  LayoutDashboard,
  Radio,
  Video,
  Film,
  Image as ImageIcon,
  History,
  BarChart3,
  FileText,
  Bell,
  Settings,
  User,
  ShieldCheck,
  LogOut,
  Search,
  Menu,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});
const NAV_MAIN = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/monitoring", label: "Live Monitoring", icon: Radio },
  { to: "/upload", label: "Upload Video", icon: Video },
  { to: "/video-analysis", label: "Video Analysis", icon: Film },
  { to: "/image-analysis", label: "Image Analysis", icon: ImageIcon },
  { to: "/history", label: "Detection History", icon: History },
];
const NAV_INSIGHTS = [
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/explainability", label: "Explainability", icon: Eye },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/alerts", label: "Alerts", icon: Bell },
];
const NAV_ACCOUNT = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/admin", label: "Administrator", icon: ShieldCheck },
];
function AuthedLayout() {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }
  return (
    <div className="flex min-h-screen bg-cockpit">
      <aside
        className={`hidden ${collapsed ? "w-[72px]" : "w-64"} flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 md:flex`}
      >
        <div className="flex items-center gap-2.5 px-5 py-6">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 shadow-[0_0_20px_-4px_var(--color-primary)]">
            <Eye className="h-4 w-4 text-primary" />
          </div>
          {!collapsed && (
            <div>
              <div className="font-display text-base font-semibold tracking-tight">DriveAlert</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Cockpit OS
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <SidebarSection label="Monitoring" collapsed={collapsed} items={NAV_MAIN} />
          <SidebarSection label="Insights" collapsed={collapsed} items={NAV_INSIGHTS} />
          <SidebarSection label="Account" collapsed={collapsed} items={NAV_ACCOUNT} />
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign out</span>}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setCollapsed((c) => !c)}
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
            <span>DriveAlert</span>
            <ChevronRight className="h-3 w-3" />
            <span>Cockpit</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-foreground">Dashboard</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search sessions, drivers, alerts…"
                className="h-9 w-72 border-border/60 bg-card/60 pl-8 text-sm backdrop-blur"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Bell className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <div className="hidden rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-metric text-xs text-muted-foreground backdrop-blur md:block">
              {time.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
            <Avatar className="h-9 w-9 border border-primary/30">
              <AvatarFallback className="bg-primary/10 text-xs text-primary">AD</AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
function SidebarSection({ label, items, collapsed }) {
  return (
    <div className="mb-5">
      {!collapsed && (
        <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
          {label}
        </div>
      )}
      <div className="space-y-0.5">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{
              className:
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm bg-sidebar-accent text-sidebar-accent-foreground font-medium border border-primary/25 shadow-[inset_0_0_20px_-6px_var(--color-primary)]",
            }}
          >
            <item.icon className="h-4 w-4 flex-shrink-0 transition-transform group-hover:scale-110" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
