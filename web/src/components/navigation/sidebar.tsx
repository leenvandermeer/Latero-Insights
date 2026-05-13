"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Activity,
  LayoutDashboard,
  ShieldCheck,
  GitBranch,
  Package,
  Layers,
  AlertTriangle,
  GitCommit,
  ClipboardList,
  ChevronLeft,
  Plus,
  Star,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useInstallation } from "@/contexts/installation-context";
import { NewDashboardModal } from "@/components/dashboard/new-dashboard-modal";
import { useBreakpoint, usePinnedDashboards } from "@/hooks";
import { useDashboards } from "@/contexts/dashboard-context";

const MONITOR_NAV = [
  { label: "Overview",     href: "/overview",    icon: LayoutDashboard },
  { label: "Runs",         href: "/runs",         icon: Activity },
  { label: "Data Quality", href: "/quality",      icon: ShieldCheck },
  { label: "Incidents",     href: "/incidents",    icon: AlertTriangle },
  { label: "Compliance",   href: "/compliance",   icon: ClipboardList },
];

const EXPLORE_NAV = [
  { label: "Products",   href: "/products",   icon: Layers },
  { label: "Catalog",    href: "/catalog",    icon: Package },
  { label: "Lineage",    href: "/lineage",    icon: GitBranch },
  { label: "Changes",    href: "/changes",    icon: GitCommit },
];

const MAX_PINNED_IN_NAV = 3;

function NavItem({
  href,
  label,
  Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "rounded-lg text-sm font-medium transition-colors",
        collapsed
          ? "flex items-center justify-center px-2 py-2.5"
          : "flex items-center gap-3 px-3 py-2.5"
      )}
      style={
        active
          ? { background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" }
          : { color: "var(--color-sidebar-muted)" }
      }
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.background = "var(--color-sidebar-hover)";
          (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-foreground)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
          (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-muted)";
        }
      }}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export function Sidebar() {
  const pathname    = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [newDashOpen, setNewDashOpen] = useState(false);
  const { installation } = useInstallation();
  const { isTablet, isSmallDesktop } = useBreakpoint();
  const isAutoCollapsed = isTablet || isSmallDesktop;
  const { userDashboards } = useDashboards();
  const { pinnedIds, toggle: togglePin } = usePinnedDashboards(installation?.installation_id);
  const pinnedDashboards = userDashboards
    .filter((d) => pinnedIds.includes(d.id))
    .slice(0, MAX_PINNED_IN_NAV);

  useEffect(() => {
    if (isAutoCollapsed) {
      setCollapsed(true);
    } else {
      setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
    }
  }, [isAutoCollapsed]);

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", collapsed ? "64px" : "248px");
    window.dispatchEvent(new Event("resize"));
    if (!isAutoCollapsed) {
      localStorage.setItem("sidebar-collapsed", String(collapsed));
    }
  }, [collapsed, isAutoCollapsed]);

  const handleCollapseToggle = (next: boolean) => {
    setCollapsed(next);
    if (!isAutoCollapsed) localStorage.setItem("sidebar-collapsed", String(next));
  };

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col transition-all duration-200 md:flex",
          collapsed ? "w-[64px]" : "w-[248px]"
        )}
        style={{
          background: "var(--color-sidebar)",
          borderRight: "1px solid var(--color-sidebar-border)",
          color: "var(--color-sidebar-foreground)",
        }}
      >
        {/* Header */}
        <div
          className="flex h-14 shrink-0 items-center px-3"
          style={{ borderBottom: "1px solid var(--color-sidebar-border)" }}
        >
          {!collapsed ? (
            <>
              <Link
                href="/"
                className="flex h-14 min-w-0 flex-1 items-center gap-2.5 transition-opacity hover:opacity-80"
                aria-label="Latero Control"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/latero-mark-light.svg" alt="Latero" width={26} height={26} className="shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold leading-none tracking-tight" style={{ color: "var(--color-brand, #1B3B6B)" }}>Latero</p>
                  <p className="mt-0.5 truncate text-xs leading-none" style={{ color: "var(--color-text-subtle)" }}>Control</p>
                </div>
              </Link>
              {!isTablet && (
                <button
                  onClick={() => handleCollapseToggle(true)}
                  className="rounded-md p-1.5 shrink-0 transition-colors"
                  style={{ color: "var(--color-sidebar-muted)" }}
                  aria-label="Collapse sidebar"
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => handleCollapseToggle(false)}
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-md transition-colors"
              style={{ cursor: "pointer" }}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo/latero-mark-light.svg" alt="Latero" width={22} height={22} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {collapsed ? (
            <div className="flex flex-col items-center gap-0.5 px-2">
              {MONITOR_NAV.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  Icon={item.icon}
                  active={pathname === item.href || pathname.startsWith(item.href + "/")}
                  collapsed
                />
              ))}
              <div className="my-1 w-8" style={{ borderTop: "1px solid var(--color-sidebar-border)" }} />
              {EXPLORE_NAV.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  Icon={item.icon}
                  active={pathname === item.href || pathname.startsWith(item.href + "/")}
                  collapsed
                />
              ))}
              <div className="my-1 w-8" style={{ borderTop: "1px solid var(--color-sidebar-border)" }} />
              <NavItem href="/dashboard" label="Dashboards" Icon={LayoutDashboard} active={pathname.startsWith("/dashboard")} collapsed />
              <button
                onClick={() => { setCollapsed(false); setNewDashOpen(true); }}
                className="flex w-full items-center justify-center rounded-lg px-2 py-2.5 transition-colors"
                style={{ color: "var(--color-sidebar-muted)" }}
                title="New dashboard"
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div>
                <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-sidebar-muted)" }}>
                  Monitor
                </p>
                <div className="space-y-0.5">
                  {MONITOR_NAV.map((item) => (
                    <NavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      Icon={item.icon}
                      active={pathname.startsWith(item.href)}
                      collapsed={false}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-sidebar-muted)" }}>
                  Explore
                </p>
                <div className="space-y-0.5">
                  {EXPLORE_NAV.map((item) => (
                    <NavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      Icon={item.icon}
                      active={pathname.startsWith(item.href)}
                      collapsed={false}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between px-3 pb-1 pt-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-sidebar-muted)" }}>
                    Dashboards
                  </p>
                  <button
                    onClick={() => setNewDashOpen(true)}
                    className="rounded-md p-1 transition-colors"
                    style={{ color: "var(--color-sidebar-muted)" }}
                    title="New personal dashboard"
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {pinnedDashboards.map((dash) => {
                    const href   = `/dashboard/${dash.id}`;
                    const active = pathname === href;
                    return (
                      <div key={dash.id} className="group/pinned flex items-center gap-0.5">
                        <Link
                          href={href}
                          prefetch={false}
                          className="flex flex-1 min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                          style={active
                            ? { background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" }
                            : { color: "var(--color-sidebar-muted)" }}
                          onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-foreground)"; } }}
                          onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-muted)"; } }}
                        >
                          <Star className="h-4 w-4 shrink-0" style={{ color: "var(--color-accent)" }} />
                          <span className="truncate">{dash.name}</span>
                        </Link>
                        <button
                          onClick={() => togglePin(dash.id)}
                          className="mr-1 shrink-0 rounded p-1 opacity-0 transition-opacity group-hover/pinned:opacity-100"
                          style={{ color: "var(--color-text-muted)" }}
                          title="Unpin"
                        >
                          <Star className="h-3 w-3" fill="currentColor" />
                        </button>
                      </div>
                    );
                  })}
                  <Link
                    href="/dashboard"
                    prefetch={false}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                    style={pathname === "/dashboard"
                      ? { color: "var(--color-sidebar-active-text)" }
                      : { color: "var(--color-text-subtle)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-foreground)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-text-subtle)"; }}
                  >
                    <ChevronRight className="h-3 w-3 shrink-0" />
                    All dashboards
                  </Link>
                </div>
              </div>
            </>
          )}
        </nav>
      </aside>

      <NewDashboardModal open={newDashOpen} onClose={() => setNewDashOpen(false)} />
    </>
  );
}
