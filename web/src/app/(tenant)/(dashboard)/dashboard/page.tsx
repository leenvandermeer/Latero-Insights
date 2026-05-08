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

const SYSTEM_ITEMS = [
  { id: "system:pipelines", label: "Pipelines",    description: "Pipeline execution health & run log", href: "/dashboard/system:pipelines", icon: BarChart3 },
  { id: "system:quality",   label: "Data Quality", description: "DQ check results & pass rate trends",  href: "/dashboard/system:quality",   icon: ShieldCheck },
];

type TabId = "all" | "pinned";

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
  isPinned,
  onTogglePin,
}: {
  dashboard: Dashboard;
  href: string;
  isPinned?: boolean;
  onTogglePin?: () => void;
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
        <LayoutDashboard className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
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

      {onTogglePin && (
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
    </div>
  );
}

export default function DashboardListPage() {
  const router = useRouter();
  const { installation } = useInstallation();
  const { userDashboards, createDash } = useDashboards();
  const { pinnedIds, toggle: togglePin, isPinned } = usePinnedDashboards(installation?.installation_id);
  const [newDashOpen, setNewDashOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");

  const sortedUser = useMemo(
    () => [...userDashboards].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [userDashboards]
  );

  const filtered = useMemo(() => {
    let list = sortedUser;
    if (activeTab === "pinned") list = list.filter((d) => pinnedIds.includes(d.id));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q));
    }
    return list;
  }, [sortedUser, activeTab, pinnedIds, search]);

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "all",    label: "All",    count: sortedUser.length },
    { id: "pinned", label: "Pinned", count: pinnedIds.length },
  ];

  return (
    <div className="space-y-6 fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--color-text)", letterSpacing: "-0.02em" }}>
            My Dashboards
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Dashboards you created
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

      {/* System dashboards — compact quick access */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          System
        </p>
        <div className="flex flex-wrap gap-3">
          {SYSTEM_ITEMS.map(({ id, label, description, href, icon: Icon }) => (
            <Link
              key={id}
              href={href}
              prefetch={false}
              className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:opacity-80"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-card)", minWidth: 220 }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <Icon className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{label}</p>
                <p className="truncate text-xs" style={{ color: "var(--color-text-muted)" }}>{description}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" style={{ color: "var(--color-text-muted)" }} />
            </Link>
          ))}
        </div>
      </div>

      {/* Search + tabs for user dashboards */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Yours
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your dashboards…"
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

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-2xl py-12 text-center" style={{ border: "1px dashed var(--color-border)" }}>
              <p className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
                {search
                  ? "No dashboards match your search."
                  : activeTab === "pinned"
                    ? "No pinned dashboards yet. Star a dashboard to pin it to the sidebar."
                    : "You haven't created any dashboards yet."}
              </p>
              {!search && activeTab === "all" && (
                <button
                  onClick={() => setNewDashOpen(true)}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
                  style={{ background: "var(--color-accent)", color: "#fff" }}
                >
                  <Plus className="h-4 w-4" />
                  Create your first dashboard
                </button>
              )}
            </div>
          ) : (
            filtered.map((dashboard) => (
              <DashboardRow
                key={dashboard.id}
                dashboard={dashboard}
                href={`/dashboard/${dashboard.id}`}
                isPinned={isPinned(dashboard.id)}
                onTogglePin={() => togglePin(dashboard.id)}
              />
            ))
          )}
        </div>
      </div>

      <NewDashboardModal open={newDashOpen} onClose={() => setNewDashOpen(false)} />
    </div>
  );
}
