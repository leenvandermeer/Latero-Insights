"use client";

import { useRef, useState, useEffect } from "react";
import { LogOut, Building2, Mail, ChevronDown, Check, Star } from "lucide-react";
import { useInstallation } from "@/contexts/installation-context";
import { cn } from "@/lib/utils";
import type { Installation } from "@/contexts/installation-context";

interface Props {
  collapsed: boolean;
}

function envBadgeStyle(env: string): React.CSSProperties {
  if (env === "production") {
    return { background: "var(--color-error-bg, #fef2f2)", color: "var(--color-error, #dc2626)" };
  }
  if (env === "staging") {
    return { background: "var(--color-warning-bg, #fffbeb)", color: "var(--color-warning, #d97706)" };
  }
  return { background: "var(--color-surface-alt, #f1f5f9)", color: "var(--color-text-muted, #94a3b8)" };
}

function envDotColor(env: string): string {
  if (env === "production") return "var(--color-error, #dc2626)";
  if (env === "staging") return "var(--color-warning, #d97706)";
  return "var(--color-text-muted, #94a3b8)";
}

export function InstallationPicker({ collapsed }: Props) {
  const { installation, installations, logout, user, defaultInstallationId, switchInstallation, setDefaultInstallation, validating } = useInstallation();
  const [open, setOpen] = useState(false);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!installation) return null;

  const label = installation.label ?? installation.installation_id;
  const isMulti = installations.length > 1;

  async function handleSetDefault(e: React.MouseEvent, inst: Installation) {
    e.stopPropagation();
    if (settingDefault) return;
    setSettingDefault(inst.installation_id);
    await setDefaultInstallation(inst.installation_id);
    setSettingDefault(null);
  }

  async function handleSwitch(inst: Installation) {
    if (inst.installation_id === installation!.installation_id) { setOpen(false); return; }
    setOpen(false);
    await switchInstallation(inst.installation_id);
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 px-2 py-2">
        <div
          className="relative w-8 h-8 rounded-md flex items-center justify-center"
          style={{ background: "var(--color-brand-subtle, rgba(27,59,107,0.1))" }}
          title={`${label} (${installation.environment})`}
        >
          <Building2 className="h-4 w-4" style={{ color: "var(--color-brand, #1B3B6B)" }} />
          {/* env dot */}
          <span
            className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-white"
            style={{ background: envDotColor(installation.environment) }}
          />
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
    <div className="px-2 pb-2" ref={ref}>
      {/* Active installation card */}
      <div
        className={cn(
          "rounded-lg px-3 py-2.5",
          isMulti && "cursor-pointer select-none",
        )}
        style={{ background: "var(--color-brand-subtle, rgba(27,59,107,0.08))", border: "1px solid var(--color-brand-border, rgba(27,59,107,0.15))" }}
        onClick={() => isMulti && setOpen((v) => !v)}
        role={isMulti ? "button" : undefined}
        aria-expanded={isMulti ? open : undefined}
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
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none" style={envBadgeStyle(installation.environment)}>
              {installation.environment}
            </span>
            {isMulti && (
              <ChevronDown
                className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
                style={{ color: "var(--color-sidebar-muted)" }}
              />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); logout(); }}
              className="p-1 rounded-md transition-colors"
              style={{ color: "var(--color-sidebar-muted)" }}
              title="Uitloggen"
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-sidebar-foreground)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-sidebar-muted)"; }}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {user?.email && (
          <p className="mt-2 text-[10px] truncate flex items-center gap-1" style={{ color: "var(--color-sidebar-muted)" }} title={user.email}>
            <Mail className="h-3 w-3" /> {user.email}
          </p>
        )}
      </div>

      {/* Multi-install dropdown */}
      {isMulti && open && (
        <div
          className="mt-1 rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--color-brand-border, rgba(27,59,107,0.15))", background: "var(--color-surface, #fff)" }}
        >
          {installations.map((inst) => {
            const isActive = inst.installation_id === installation.installation_id;
            const isDefault = inst.installation_id === defaultInstallationId;
            const instLabel = inst.label ?? inst.installation_id;
            return (
              <button
                key={inst.installation_id}
                type="button"
                disabled={validating}
                onClick={() => void handleSwitch(inst)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs transition-colors disabled:opacity-60"
                style={{
                  background: isActive ? "var(--color-brand-subtle, rgba(27,59,107,0.08))" : "transparent",
                  color: "var(--color-text)",
                  borderBottom: "1px solid var(--color-border, #e2e8f0)",
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover, #f1f5f9)"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isActive
                    ? <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-brand, #1B3B6B)" }} />
                    : <span className="w-3.5 h-3.5 shrink-0" />
                  }
                  <span className="truncate font-medium">{instLabel}</span>
                  <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none shrink-0" style={envBadgeStyle(inst.environment)}>
                    {inst.environment}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => void handleSetDefault(e, inst)}
                  disabled={!!settingDefault}
                  title={isDefault ? "Default installation" : "Set as default"}
                  className="p-0.5 rounded transition-colors shrink-0 disabled:opacity-50"
                  style={{ color: isDefault ? "var(--color-warning, #d97706)" : "var(--color-text-muted, #94a3b8)" }}
                >
                  <Star className={cn("h-3.5 w-3.5", isDefault && "fill-current")} />
                </button>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

