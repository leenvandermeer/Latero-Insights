import { type ReactNode } from "react";

interface WidgetHeaderProps {
  title: string;
  icon?: ReactNode;
  meta?: ReactNode;
}

export function WidgetHeader({ title, icon, meta }: WidgetHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-5 py-3 shrink-0"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
          {title}
        </p>
      </div>
      {meta && (
        <span className="text-xs shrink-0 ml-3" style={{ color: "var(--color-text-muted)" }}>
          {meta}
        </span>
      )}
    </div>
  );
}
