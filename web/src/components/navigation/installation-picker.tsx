"use client";

import { Layers } from "lucide-react";
import { useInstallation } from "@/contexts/installation-context";
import { cn } from "@/lib/utils";

interface Props {
  collapsed: boolean;
}

export function InstallationPicker({ collapsed }: Props) {
  const { installationId, setInstallationId, installations } = useInstallation();

  // Only render when there are multiple installations to choose from
  if (installations.length <= 1) return null;

  const active = installations.find((i) => i.installation_id === installationId);
  const displayLabel = active
    ? (active.label ?? active.installation_id)
    : "All installations";

  if (collapsed) {
    return (
      <div className="flex justify-center px-2 py-2" title={displayLabel}>
        <div className="relative">
          <Layers className="h-4 w-4" style={{ color: installationId ? "var(--color-brand, #1B3B6B)" : "var(--color-sidebar-muted)" }} />
          {installationId && (
            <span
              className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
              style={{ background: "var(--color-brand, #1B3B6B)" }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 pb-1">
      <p
        className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "var(--color-sidebar-muted)" }}
      >
        Installation
      </p>
      <select
        value={installationId ?? ""}
        onChange={(e) => setInstallationId(e.target.value || null)}
        className={cn(
          "w-full rounded-lg px-3 py-2 text-sm font-medium appearance-none cursor-pointer outline-none transition-colors",
        )}
        style={{
          background: "var(--color-sidebar-hover)",
          color: "var(--color-sidebar-foreground)",
          border: "1px solid var(--color-sidebar-border)",
        }}
        aria-label="Select installation"
      >
        <option value="">All installations</option>
        {installations.map((i) => (
          <option key={i.installation_id} value={i.installation_id}>
            {i.label ?? i.installation_id}
            {i.environment ? ` (${i.environment})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
