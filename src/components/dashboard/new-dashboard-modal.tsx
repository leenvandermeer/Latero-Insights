"use client";

import { useState } from "react";
import { X, LayoutDashboard, ChevronLeft, ChevronRight } from "lucide-react";
import { useDashboards } from "@/contexts/dashboard-context";
import { useRouter } from "next/navigation";

interface NewDashboardModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewDashboardModal({ open, onClose }: NewDashboardModalProps) {
  const { createDash } = useDashboards();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const handleCreate = () => {
    if (!name.trim()) return;
    const dash = createDash(name.trim(), description.trim() || undefined);
    onClose();
    setName("");
    setDescription("");
    setCollapsed(false);
    router.push(`/dashboard/${dash.id}`);
  };

  if (!open) return null;

  return (
    <>
      {!collapsed && (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
      )}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out"
        style={{
          width: collapsed ? 36 : 320,
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-drawer, -4px 0 24px rgba(27,59,107,0.12))",
          animation: "slideInRight 0.2s ease-out",
          overflow: "hidden",
        }}
      >
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute top-3 -left-3.5 z-10 flex items-center justify-center rounded-full w-7 h-7 shadow-sm border"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-muted)",
          }}
          title={collapsed ? "Tonen" : "Verbergen"}
        >
          {collapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {!collapsed && (
          <>
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
                <h2 className="font-display font-semibold text-base" style={{ color: "var(--color-text)" }}>
                  Nieuw dashboard
                </h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: "var(--color-text-muted)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Naam <span style={{ color: "var(--color-error)" }}>*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Mijn operationeel overzicht"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                  Beschrijving
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optioneel"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              className="shrink-0 px-5 py-4 flex gap-2"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <button
                onClick={onClose}
                className="flex-1 rounded-lg py-2 text-sm font-medium"
                style={{ background: "var(--color-sidebar-hover)", color: "var(--color-text-muted)" }}
              >
                Annuleren
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="flex-1 rounded-lg py-2 text-sm font-medium transition-opacity disabled:opacity-40"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                Aanmaken
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
