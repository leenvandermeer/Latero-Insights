"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Activity,
  LayoutDashboard,
  ShieldCheck,
  GitBranch,
  Network,
  Settings,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Database,
  Plus,
  ChevronDown,
  Trash2,
  Info,
  LogOut,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboards } from "@/contexts/dashboard-context";
import { useInstallation } from "@/contexts/installation-context";
import { NewDashboardModal } from "@/components/dashboard/new-dashboard-modal";
import { useBreakpoint } from "@/hooks";

const SYSTEM_NAV = [
  { label: "Pipelines",    href: "/pipelines",    icon: Activity },
  { label: "Data Quality", href: "/quality",       icon: ShieldCheck },
  { label: "Datasets",     href: "/datasets",      icon: Database },
];

const LINEAGE_NAV = [
  { label: "Lineage",      href: "/lineage",      icon: GitBranch },
  { label: "OpenLineage",  href: "/openlineage",  icon: Network },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [userDashOpen, setUserDashOpen] = useState(true);
  const [lineageOpen, setLineageOpen] = useState(true);
  const [newDashOpen, setNewDashOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { userDashboards, deleteDash } = useDashboards();
  const { user } = useInstallation();
  const isAdmin = user?.is_admin ?? false;
  const { isTablet, isSmallDesktop } = useBreakpoint();
  // isTablet      = 768–1023px: always collapsed, no expand button
  // isSmallDesktop = 1024–1279px: collapsed by default, user can expand
  // neither        = ≥1280px: expanded by default, user can collapse (LADR-013)
  const isAutoCollapsed = isTablet || isSmallDesktop;

  // Init theme from localStorage
  useEffect(() => {
    const stored = (localStorage.getItem("theme") as "light" | "dark") ?? "light";
    setTheme(stored);
  }, []);

  // LINS-011 / LADR-013: auto-collapse at <1280px; restore user preference at ≥1280px
  useEffect(() => {
    if (isAutoCollapsed) {
      setCollapsed(true);
    } else {
      const storedCollapsed = localStorage.getItem("sidebar-collapsed") === "true";
      setCollapsed(storedCollapsed);
    }
  }, [isAutoCollapsed]);

  // Sync --sidebar-width CSS var; persist preference only at ≥1280px
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      collapsed ? "64px" : "280px"
    );
    // Trigger a resize event so react-grid-layout re-measures the container
    // width after the sidebar expands or collapses.
    window.dispatchEvent(new Event("resize"));
    if (!isAutoCollapsed) {
      localStorage.setItem("sidebar-collapsed", String(collapsed));
    }
  }, [collapsed, isAutoCollapsed]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/");
    router.refresh();
  };

  const handleCollapseToggle = (next: boolean) => {
    setCollapsed(next);
    // Persist only at ≥1280px; smaller viewports are viewport-driven (LADR-013)
    if (!isAutoCollapsed) {
      localStorage.setItem("sidebar-collapsed", String(next));
    }
  };

  const handleDeleteDash = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirm(id);
  };

  const confirmDelete = (id: string) => {
    deleteDash(id);
    setDeleteConfirm(null);
    if (pathname === `/dashboard/${id}`) {
      router.push("/pipelines");
    }
  };

  return (
    <>
      <aside
        className={cn(
          "hidden md:flex flex-col fixed inset-y-0 left-0 z-30 transition-all duration-200",
          collapsed ? "w-[64px]" : "w-[280px]"
        )}
        style={{
          background: "var(--color-sidebar)",
          borderRight: "1px solid var(--color-sidebar-border)",
          color: "var(--color-sidebar-foreground)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-3 shrink-0" style={{ borderBottom: "1px solid var(--color-sidebar-border)" }}>
          {!collapsed ? (
            <div className="flex items-center justify-between w-full">
              <Link href="/" className="flex items-center gap-2.5 min-w-0 flex-1 h-14 hover:opacity-80 transition-opacity" aria-label="Latero Control">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/latero-mark-light.svg" alt="Latero" width={28} height={28} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-none tracking-tight truncate" style={{ color: "var(--color-brand, #1B3B6B)" }}>Latero</p>
                  <p className="text-xs leading-none mt-0.5 truncate" style={{ color: "var(--color-text-subtle)" }}>Control</p>
                </div>
              </Link>
              {/* Hide collapse button at md (768–1023px): sidebar is always collapsed there */}
              {!isTablet && (
                <button onClick={() => handleCollapseToggle(true)} className="p-1.5 rounded-md" style={{ color: "var(--color-sidebar-muted)" }} aria-label="Collapse">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => handleCollapseToggle(false)}
              className="mx-auto flex items-center justify-center w-8 h-8 rounded-md"
              style={{ color: "var(--color-brand, #1B3B6B)", cursor: "pointer" }}
              aria-label="Expand"
              title="Expand sidebar"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo/latero-mark-light.svg" alt="Latero" width={22} height={22} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
          {/* System section label */}
          {!collapsed && (
            <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-sidebar-muted)" }}>
              System Dashboards
            </p>
          )}

          {SYSTEM_NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors", collapsed && "justify-center px-2")}
                style={active ? { background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" } : { color: "var(--color-sidebar-muted)" }}
                onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-foreground)"; } }}
                onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-muted)"; } }}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}

          {/* Lineage — collapsed: icon-only */}
          {collapsed && LINEAGE_NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors justify-center px-2")}
                style={active ? { background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" } : { color: "var(--color-sidebar-muted)" }}
                onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-foreground)"; } }}
                onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-muted)"; } }}
                title={item.label}
              >
                <Icon className="h-4 w-4 shrink-0" />
              </Link>
            );
          })}

          {/* Lineage section — expanded */}
          {!collapsed && (
            <div className="pt-3">
              <button
                onClick={() => setLineageOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 pb-1 pt-1"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-sidebar-muted)" }}>
                  Lineage
                </p>
                <ChevronDown className={cn("h-3 w-3 transition-transform", !lineageOpen && "-rotate-90")} style={{ color: "var(--color-sidebar-muted)" }} />
              </button>
              {lineageOpen && (
                <div className="space-y-0.5">
                  {LINEAGE_NAV.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn("flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors")}
                        style={active ? { background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" } : { color: "var(--color-sidebar-muted)" }}
                        onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-foreground)"; } }}
                        onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-muted)"; } }}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* My Dashboards */}
          {!collapsed && (
            <div className="pt-3">
              <div className="flex items-center justify-between px-3 pb-1 pt-1">
                <Link
                  href="/dashboard"
                  className="text-[10px] font-bold uppercase tracking-widest hover:opacity-70 transition-opacity"
                  style={{ color: pathname === "/dashboard" ? "var(--color-sidebar-active-text)" : "var(--color-sidebar-muted)" }}
                >
                  My Dashboards
                </Link>
                <button
                  onClick={() => setUserDashOpen((v) => !v)}
                  className="p-0.5 rounded hover:opacity-70 transition-opacity"
                >
                  <ChevronDown className={cn("h-3 w-3 transition-transform", !userDashOpen && "-rotate-90")} style={{ color: "var(--color-sidebar-muted)" }} />
                </button>
              </div>

              {userDashOpen && (
                <div className="space-y-0.5">
                  {userDashboards.map((dash) => {
                    const active = pathname === `/dashboard/${dash.id}`;
                    return (
                      <div key={dash.id} className="group flex items-center">
                        <Link
                          href={`/dashboard/${dash.id}`}
                          className={cn("flex-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors truncate")}
                          style={active ? { background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" } : { color: "var(--color-sidebar-muted)" }}
                          onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-foreground)"; } }}
                          onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-muted)"; } }}
                        >
                          <LayoutDashboard className="h-4 w-4 shrink-0" />
                          <span className="truncate">{dash.name}</span>
                        </Link>
                        <button
                          onClick={(e) => handleDeleteDash(e, dash.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded mr-1 transition-opacity"
                          style={{ color: "var(--color-text-muted)" }}
                          title="Delete dashboard"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    onClick={() => setNewDashOpen(true)}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                    style={{ color: "var(--color-sidebar-muted)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-sidebar-foreground)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-sidebar-muted)"; }}
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span>New Dashboard</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {collapsed && (
            <>
              <Link
                href="/dashboard"
                className="w-full flex justify-center px-2 py-2.5 rounded-lg"
                style={pathname === "/dashboard" ? { background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" } : { color: "var(--color-sidebar-muted)" }}
                onMouseEnter={(e) => { if (pathname !== "/dashboard") { (e.currentTarget as HTMLAnchorElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-foreground)"; } }}
                onMouseLeave={(e) => { if (pathname !== "/dashboard") { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-muted)"; } }}
                title="My Dashboards"
              >
                <LayoutDashboard className="h-4 w-4" />
              </Link>
              <button
                onClick={() => { setCollapsed(false); setNewDashOpen(true); }}
                className="w-full flex justify-center px-2 py-2.5 rounded-lg"
                style={{ color: "var(--color-sidebar-muted)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-sidebar-foreground)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-sidebar-muted)"; }}
                title="New Dashboard"
              >
                <Plus className="h-4 w-4" />
              </button>
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="px-2 pb-3 space-y-0.5" style={{ borderTop: "1px solid var(--color-sidebar-border)", paddingTop: 12 }}>
          <Link
            href="/account"
            className={cn("flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors", collapsed && "justify-center px-2")}
            style={pathname === "/account" ? { background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" } : { color: "var(--color-sidebar-muted)" }}
            onMouseEnter={(e) => { if (pathname !== "/account") { (e.currentTarget as HTMLAnchorElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-foreground)"; } }}
            onMouseLeave={(e) => { if (pathname !== "/account") { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-muted)"; } }}
            title={collapsed ? "Account" : undefined}
          >
            <UserCircle className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Account</span>}
          </Link>
          <Link
            href="/about"
            className={cn("flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors", collapsed && "justify-center px-2")}
            style={pathname === "/about" ? { background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" } : { color: "var(--color-sidebar-muted)" }}
            onMouseEnter={(e) => { if (pathname !== "/about") { (e.currentTarget as HTMLAnchorElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-foreground)"; } }}
            onMouseLeave={(e) => { if (pathname !== "/about") { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-muted)"; } }}
            title={collapsed ? "About" : undefined}
          >
            <Info className="h-4 w-4 shrink-0" />
            {!collapsed && <span>About</span>}
          </Link>
          {isAdmin && (
            <Link
              href="/settings"
              className={cn("flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors", collapsed && "justify-center px-2")}
              style={pathname === "/settings" ? { background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" } : { color: "var(--color-sidebar-muted)" }}
              onMouseEnter={(e) => { if (pathname !== "/settings") { (e.currentTarget as HTMLAnchorElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-foreground)"; } }}
              onMouseLeave={(e) => { if (pathname !== "/settings") { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-muted)"; } }}
              title={collapsed ? "Settings" : undefined}
            >
              <Settings className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Settings</span>}
            </Link>
          )}
          <button
            onClick={toggleTheme}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors w-full", collapsed && "justify-center px-2")}
            style={{ color: "var(--color-sidebar-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-sidebar-foreground)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-sidebar-muted)"; }}
            title={collapsed ? (theme === "light" ? "Dark mode" : "Light mode") : undefined}
          >
            {theme === "light" ? <Moon className="h-4 w-4 shrink-0" /> : <Sun className="h-4 w-4 shrink-0" />}
            {!collapsed && <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>}
          </button>
          <button
            onClick={handleLogout}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors w-full", collapsed && "justify-center px-2")}
            style={{ color: "var(--color-error, #dc2626)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            title={collapsed ? "Log out" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl p-6 shadow-xl" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>Delete dashboard?</h3>
            <p className="text-xs mb-5" style={{ color: "var(--color-text-muted)" }}>
              {userDashboards.find((d) => d.id === deleteConfirm)?.name ?? "This dashboard"} will be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(deleteConfirm)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                style={{ background: "var(--color-error, #dc2626)" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <NewDashboardModal open={newDashOpen} onClose={() => setNewDashOpen(false)} />
    </>
  );
}
