"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutGrid, Plus, LayoutDashboard } from "lucide-react";
import { useDashboards } from "@/contexts/dashboard-context";
import { NewDashboardModal } from "@/components/dashboard/new-dashboard-modal";

export default function DashboardGalleryPage() {
  const { userDashboards } = useDashboards();
  const [newDashOpen, setNewDashOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--color-accent)", letterSpacing: "0.13em" }}>
            My Dashboards
          </p>
          <h1 className="font-display font-light italic" style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", color: "var(--color-text)", letterSpacing: "-0.02em" }}>
            Dashboard Gallery
          </h1>
        </div>
        <button
          onClick={() => setNewDashOpen(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          <Plus className="h-4 w-4" />
          New Dashboard
        </button>
      </div>

      {/* Gallery grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {userDashboards.map((dash) => (
          <Link
            key={dash.id}
            href={`/dashboard/${dash.id}`}
            className="group rounded-2xl p-5 transition-all block"
            style={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--color-accent)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--color-border)")}
          >
            {/* Preview area */}
            <div
              className="rounded-xl mb-4 flex items-center justify-center"
              style={{ height: 100, background: "linear-gradient(135deg, var(--color-surface) 60%, var(--color-brand-subtle) 100%)", border: "1px solid var(--color-border)" }}
            >
              <LayoutDashboard className="h-8 w-8" style={{ color: "var(--color-text-muted)", opacity: 0.4 }} />
            </div>
            <p className="font-semibold text-sm truncate" style={{ color: "var(--color-text)" }}>{dash.name}</p>
            {dash.description && (
              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--color-text-muted)" }}>{dash.description}</p>
            )}
            <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
              {dash.widgets.length} widget{dash.widgets.length !== 1 ? "s" : ""}
            </p>
          </Link>
        ))}

        {/* New Dashboard card */}
        <button
          onClick={() => setNewDashOpen(true)}
          className="rounded-2xl p-5 flex flex-col items-center justify-center gap-2 transition-all text-center"
          style={{
            border: "2px dashed var(--color-border)",
            color: "var(--color-text-muted)",
            minHeight: 180,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
          }}
        >
          <Plus className="h-8 w-8" />
          <p className="text-sm font-medium">New Dashboard</p>
        </button>
      </div>

      {userDashboards.length === 0 && (
        <div className="text-center py-10">
          <LayoutGrid className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "var(--color-text)" }}>No dashboards yet</p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Create your first dashboard to get started</p>
        </div>
      )}

      <NewDashboardModal open={newDashOpen} onClose={() => setNewDashOpen(false)} />
    </div>
  );
}
