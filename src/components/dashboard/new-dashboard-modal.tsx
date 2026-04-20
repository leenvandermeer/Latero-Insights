"use client";

import { useState } from "react";
import { X } from "lucide-react";
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

  if (!open) return null;

  const handleCreate = () => {
    if (!name.trim()) return;
    const dash = createDash(name.trim(), description.trim() || undefined);
    onClose();
    setName("");
    setDescription("");
    router.push(`/dashboard/${dash.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-elevated, 0 24px 48px rgba(27,59,107,0.18))" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg" style={{ color: "var(--color-text)" }}>
            New Dashboard
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5" style={{ color: "var(--color-text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            Name <span style={{ color: "var(--color-error)" }}>*</span>
          </label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="My operational view"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg py-2 text-sm font-medium"
            style={{ background: "var(--color-sidebar-hover)", color: "var(--color-text-muted)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex-1 rounded-lg py-2 text-sm font-medium transition-opacity disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
