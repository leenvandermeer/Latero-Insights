"use client";

import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  // Legacy props — accepted but no longer rendered
  eyebrow?: string;
  description?: string;
  className?: string;
}

export function PageHeader({ title, icon: Icon, actions }: PageHeaderProps) {
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

      {/* Right: actions */}
      {actions && (
        <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
      )}
    </div>
  );
}
