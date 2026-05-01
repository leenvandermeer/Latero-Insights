"use client";

import Link from "next/link";
import { LogOut, Building2, Mail } from "lucide-react";
import { useInstallation } from "@/contexts/installation-context";
import { cn } from "@/lib/utils";

interface Props {
  collapsed: boolean;
}

export function InstallationPicker({ collapsed }: Props) {
  const { installation, logout, user } = useInstallation();

  if (!installation) return null;

  const label = installation.label ?? installation.installation_id;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 px-2 py-2">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center"
          style={{ background: "var(--color-brand-subtle, rgba(27,59,107,0.1))" }}
          title={label}
        >
          <Building2 className="h-4 w-4" style={{ color: "var(--color-brand, #1B3B6B)" }} />
        </div>
        <button
          onClick={logout}
          className="flex items-center justify-center w-8 h-8 rounded-md transition-colors"
          style={{ color: "var(--color-sidebar-muted)" }}
          title="Uitloggen"
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-2 pb-2">
      <div
        className="rounded-lg px-3 py-2.5"
        style={{ background: "var(--color-brand-subtle, rgba(27,59,107,0.08))", border: "1px solid var(--color-brand-border, rgba(27,59,107,0.15))" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-brand, #1B3B6B)" }} />
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate leading-none" style={{ color: "var(--color-brand, #1B3B6B)" }}>
                {label}
              </p>
              <p className="text-[10px] mt-0.5 truncate leading-none" style={{ color: "var(--color-sidebar-muted)" }}>
                {installation.installation_id}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className={cn("p-1.5 rounded-md shrink-0 transition-colors")}
            style={{ color: "var(--color-sidebar-muted)" }}
            title="Uitloggen"
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-sidebar-foreground)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-sidebar-muted)"; }}
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>

        {user?.email && (
          <p className="mt-2 text-[10px] truncate flex items-center gap-1" style={{ color: "var(--color-sidebar-muted)" }} title={user.email}>
            <Mail className="h-3 w-3" /> {user.email}
          </p>
        )}
      </div>
    </div>
  );
}
