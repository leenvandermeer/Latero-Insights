"use client";

import type { LucideIcon } from "lucide-react";
import { useInstallation } from "@/contexts/installation-context";

interface PageHeaderProps {
  title: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  // Legacy props — accepted but no longer rendered
  eyebrow?: string;
  description?: string;
  className?: string;
}

const ENV_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  prod:       { bg: "rgba(239,68,68,0.10)",   color: "#dc2626", dot: "#ef4444" },
  production: { bg: "rgba(239,68,68,0.10)",   color: "#dc2626", dot: "#ef4444" },
  staging:    { bg: "rgba(245,158,11,0.11)",  color: "#b45309", dot: "#f59e0b" },
  acc:        { bg: "rgba(245,158,11,0.11)",  color: "#b45309", dot: "#f59e0b" },
  dev:        { bg: "rgba(8,145,178,0.10)",   color: "#0e7490", dot: "#06b6d4" },
  develop:    { bg: "rgba(8,145,178,0.10)",   color: "#0e7490", dot: "#06b6d4" },
  test:       { bg: "rgba(139,92,246,0.10)",  color: "#7c3aed", dot: "#8b5cf6" },
};

function envStyle(env: string) {
  return ENV_STYLE[env?.toLowerCase()] ?? { bg: "rgba(128,128,128,0.08)", color: "var(--color-text-muted)", dot: "var(--color-text-muted)" };
}

export function PageHeader({ title, icon: Icon, actions }: PageHeaderProps) {
  const { installation } = useInstallation();
  const env = installation?.environment;
  const label = installation?.label ?? installation?.installation_id;
  const style = env ? envStyle(env) : null;

  return (
    <div
      className="flex items-center gap-3 mb-5 min-h-[44px]"
      style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "12px" }}
    >
      {/* Left: icon + title */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />}
        <h1
          className="text-[17px] font-semibold leading-none truncate"
          style={{ color: "var(--color-text)", letterSpacing: "-0.02em" }}
        >
          {title}
        </h1>
      </div>

      {/* Right: env pill + actions */}
      <div className="flex items-center gap-2 shrink-0">
        {env && style && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
            style={{ background: style.bg, color: style.color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
            {env}
          </span>
        )}
        {actions && <div className="flex items-center gap-1.5">{actions}</div>}
      </div>
    </div>
  );
}
