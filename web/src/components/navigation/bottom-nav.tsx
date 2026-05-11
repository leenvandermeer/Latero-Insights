"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  LayoutDashboard,
  ShieldCheck,
  GitBranch,
  Network,
  ClipboardCheck,
  Settings,
  Database,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-config";

const iconMap: Record<string, React.ElementType> = {
  Activity,
  LayoutDashboard,
  ShieldCheck,
  GitBranch,
  Network,
  ClipboardCheck,
  Settings,
  Database,
};

const primaryItems = navItems.slice(0, 4);
const moreItems = navItems.slice(4);

export function BottomNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-30 flex md:hidden border-t bg-card"
        style={{ borderColor: "var(--color-border)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {primaryItems.map((item) => {
          const Icon = iconMap[item.icon];
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[var(--touch-target-min)] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors",
                active
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              )}
            >
              {Icon && <Icon className="h-5 w-5" />}
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setSheetOpen(true)}
          className={cn(
            "flex min-h-[var(--touch-target-min)] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors",
            sheetOpen
              ? "text-[var(--color-accent)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {/* Bottom sheet */}
      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="fixed bottom-0 inset-x-0 z-50 md:hidden rounded-t-2xl pb-safe"
            style={{
              background: "var(--color-surface)",
              borderTop: "1px solid var(--color-border)",
              boxShadow: "0 -4px 24px rgba(27,59,107,0.14)",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
              animation: "slideUpSheet 0.2s ease-out",
            }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>More</span>
              <button
                onClick={() => setSheetOpen(false)}
                className="rounded-lg p-1.5"
                style={{ color: "var(--color-text-muted)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-2 py-2">
              {moreItems.map((item) => {
                const Icon = iconMap[item.icon];
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSheetOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors"
                    style={{
                      color: active ? "var(--color-accent)" : "var(--color-text)",
                      background: active ? "var(--color-accent-subtle)" : "transparent",
                    }}
                  >
                    {Icon && <Icon className="h-5 w-5 shrink-0" />}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
