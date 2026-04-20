"use client";

import { useState } from "react";
import { X, Settings2, Trash2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  dashboardId: string;
  name: string;
  description?: string;
  onClose: () => void;
  onRename: (name: string, description?: string) => void;
  onDelete: () => void;
}

export function DashboardSettingsDialog({ name, description, onClose, onRename, onDelete }: Props) {
  const [nameInput, setNameInput] = useState(name);
  const [descInput, setDescInput] = useState(description ?? "");
  const [deletePhase, setDeletePhase] = useState<"idle" | "confirm">("idle");
  const [collapsed, setCollapsed] = useState(false);

  const handleSave = () => {
    if (!nameInput.trim()) return;
    onRename(nameInput.trim(), descInput.trim() || undefined);
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

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
          title={collapsed ? "Instellingen tonen" : "Instellingen verbergen"}
        >
          {collapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {/* Content — hidden when collapsed */}
        {!collapsed && (
        <>{/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
            <h2 className="font-display font-semibold text-base" style={{ color: "var(--color-text)" }}>
              Dashboard instellingen
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

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* General section */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
              Algemeen
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                Name <span style={{ color: "var(--color-error)" }}>*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{
                  background: "var(--color-card)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                Description
              </label>
              <input
                type="text"
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{
                  background: "var(--color-card)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={!nameInput.trim()}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                Opslaan
              </button>
            </div>
          </section>

          {/* Danger zone */}
          <section className="space-y-4">
            <h3
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: "var(--color-error, #EF4444)" }}
            >
              Gevarenzone
            </h3>

            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                border: "1px solid rgba(239,68,68,0.25)",
                background: "rgba(239,68,68,0.04)",
              }}
            >
              {deletePhase === "idle" ? (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                      Delete this dashboard
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      This action cannot be undone.
                    </p>
                  </div>
                  <button
                    onClick={() => setDeletePhase("confirm")}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium border"
                    style={{
                      borderColor: "rgba(239,68,68,0.4)",
                      color: "var(--color-error, #EF4444)",
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      className="h-4 w-4 shrink-0 mt-0.5"
                      style={{ color: "var(--color-error, #EF4444)" }}
                    />
                    <p className="text-sm" style={{ color: "var(--color-text)" }}>
                      Are you sure you want to delete <strong>{name}</strong>? All widgets and layout
                      configuration will be permanently removed.
                    </p>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setDeletePhase("idle")}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium"
                      style={{ background: "var(--color-sidebar-hover)", color: "var(--color-text-muted)" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
                      style={{ background: "var(--color-error, #EF4444)", color: "#fff" }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Yes, delete dashboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
        </>
        )}
      </div>
    </>
  );
}
