"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Plus, BarChart3, ShieldCheck, Star,
  ArrowRight, Search, Sparkles,
} from "lucide-react";
import { useDashboards } from "@/contexts/dashboard-context";
import { useInstallation } from "@/contexts/installation-context";
import { usePinnedDashboards } from "@/hooks/use-pinned-dashboards";
import { NewDashboardModal } from "@/components/dashboard/new-dashboard-modal";
import type { Dashboard } from "@/types/dashboard";

const SYSTEM_ROUTE: Record<string, string> = {
  "system:pipelines": "/dashboard/system:pipelines",
  "system:quality":   "/dashboard/system:quality",
  "system:bcbs239":   "/dashboard/system:bcbs239",
};

const SYSTEM_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  "system:pipelines": BarChart3,
  "system:quality":   ShieldCheck,
  "system:bcbs239":   LayoutDashboard,
};

type TabId = "all" | "system" | "mine" | "pinned";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function DashboardRow({
  dashboard,
  href,
  icon: Icon,
  isPinned,
  onTogglePin,
  showPin,
}: {
  dashboard: Dashboard;
  href: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>,
  isPinned?: boolean;
  onTogglePin?: () => void;
  showPin: boolean;
}) {
  return (
    <div
      className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-colors"
      style={{ border: "1px solid var(--color-border)", background: "var(--color-card)" }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <Icon className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ color: "var(--color-text)" }}>
          {dashboard.name}
        </p>
        {dashboard.description && (
          <p className="truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
            {dashboard.description}
          </p>
        )}
      </div>

      <div className="hidden shrink-0 items-center gap-4 text-xs sm:flex" style={{ color: "var(--color-text-muted)" }}>
        <span>{dashboard.widgets.length} widget{dashboard.widgets.length !== 1 ? "s" : ""}</span>
        <span>{formatDate(dashboard.updatedAt)}</span>
      </div>

      {showPin && onTogglePin && (
        <button
          onClick={(e) => { e.preventDefault(); onTogglePin(); }}
          className="shrink-0 rounded-md p-1.5 transition-colors"
          style={{ color: isPinned ? "var(--color-accent)" : "var(--color-text-muted)" }}
          title={isPinned ? "Unpin from sidebar" : "Pin to sidebar"}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <Star className="h-4 w-4" fill={isPinned ? "currentColor" : "none"} />
        </button>
      )}

      <Link
        href={href}
        prefetch={false}
        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: "var(--color-sidebar-hover)", color: "var(--color-text)" }}
      >
        Open
        <ArrowRight className="ml-1 inline h-3 w-3" />
      </Link>
    </div>
  );
}

export default function DashboardListPage() {
  const router = useRouter();
  const { installation } = useInstallation();
  const { userDashboards, systemDashboards, createDash } = useDashboards();
  const { pinnedIds, toggle: togglePin, isPinned } = usePinnedDashboards(installation?.installation_id);
  const [newDashOpen, setNewDashOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");

  const allDashboards: { dashboard: Dashboard; href: string; isSystem: boolean }[] = useMemo(() => {
    const sys = systemDashboards.map((d) => ({
      dashboard: d,
      href: SYSTEM_ROUTE[d.id] ?? `/dashboard/${d.id}`,
      isSystem: true,
    }));
    const user = [...userDashboards]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map((d) => ({
        dashboard: d,
        href: `/dashboard/${d.id}`,
        isSystem: false,
      }));
    return [...sys, ...user];
  }, [systemDashboards, userDashboards]);

  const filtered = useMemo(() => {
    let list = allDashboards;
    if (activeTab === "system") list = list.filter((d) => d.isSystem);
    else if (activeTab === "mine") list = list.filter((d) => !d.isSystem);
    else if (activeTab === "pinned") list = list.filter((d) => !d.isSystem && pinnedIds.includes(d.dashboard.id));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((d) => d.dashboard.name.toLowerCase().includes(q));
    }
    return list;
  }, [allDashboards, activeTab, pinnedIds, search]);

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "all",    label: "All",    count: allDashboards.length },
    { id: "system", label: "System", count: systemDashboards.length },
    { id: "mine",   label: "Mine",   count: userDashboards.length },
    { id: "pinned", label: "Pinned", count: pinnedIds.length },
  ];

  return (
    <div className="space-y-5 fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--color-text)", letterSpacing: "-0.02em" }}>
            Dashboards
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {allDashboards.length} dashboard{allDashboards.length !== 1 ? "s" : ""}
            {pinnedIds.length > 0 ? ` · ${pinnedIds.length} pinned` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/widget-builder"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            <Sparkles className="h-4 w-4" />
            Build widget
          </Link>
          <button
            onClick={() => setNewDashOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            <Plus className="h-4 w-4" />
            New dashboard
          </button>
        </div>
      </div>

      {/* Search + tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dashboards…"
            className="w-full rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2"
            style={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                activeTab === tab.id
                  ? { background: "var(--color-card)", color: "var(--color-text)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                  : { color: "var(--color-text-muted)" }
              }
            >
              {tab.label}
              <span
                className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]"
                style={{ background: activeTab === tab.id ? "var(--color-sidebar-hover)" : "transparent" }}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-2xl py-12 text-center" style={{ border: "1px dashed var(--color-border)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
              {search ? "No dashboards match your search." : activeTab === "pinned" ? "No pinned dashboards yet. Star a dashboard to pin it to the sidebar." : "No dashboards."}
            </p>
            {!search && activeTab === "mine" && (
              <button
                onClick={() => setNewDashOpen(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                <Plus className="h-4 w-4" />
                New dashboard
              </button>
            )}
          </div>
        ) : (
          filtered.map(({ dashboard, href, isSystem }) => {
            const Icon = isSystem ? (SYSTEM_ICONS[dashboard.id] ?? LayoutDashboard) : LayoutDashboard;
            return (
              <DashboardRow
                key={dashboard.id}
                dashboard={dashboard}
                href={href}
                icon={Icon}
                isPinned={!isSystem && isPinned(dashboard.id)}
                onTogglePin={!isSystem ? () => togglePin(dashboard.id) : undefined}
                showPin={!isSystem}
              />
            );
          })
        )}
      </div>

      <NewDashboardModal open={newDashOpen} onClose={() => setNewDashOpen(false)} />
    </div>
  );
}
