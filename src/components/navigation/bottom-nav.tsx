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
} from "lucide-react";
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

const mobileItems = [
  ...navItems.slice(0, 4),
  { label: "More", href: "/settings", icon: "Settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 flex md:hidden border-t bg-card"
      style={{ borderColor: "var(--color-border)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {mobileItems.map((item) => {
        const Icon = iconMap[item.icon];
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors",
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
    </nav>
  );
}
