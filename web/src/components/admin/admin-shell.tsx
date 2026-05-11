"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ActivitySquare,
  Building2,
  ChevronDown,
  Home,
  LogOut,
  Moon,
  Sun,
  UserCircle,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminShellProps {
  children: ReactNode;
  sessionEmail: string;
}

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: Home, exact: true },
  { href: "/admin/installations", label: "Installations", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/health", label: "Health", icon: ActivitySquare },
  { href: "/admin/audit", label: "Audit Log", icon: Activity },
];

function getAdminHeader(pathname: string) {
  if (pathname === "/admin") return { title: "Platform Admin", subtitle: "Overview of tenant operations and platform posture" };
  if (pathname === "/admin/installations") return { title: "Installations", subtitle: "Tenant lifecycle, connectivity and onboarding" };
  if (pathname.startsWith("/admin/installations/") && pathname.endsWith("/auth")) {
    return { title: "Auth Configuration", subtitle: "Authentication mode and identity settings" };
  }
  if (pathname.startsWith("/admin/installations/")) {
    return { title: "Installation Detail", subtitle: "Tenant configuration, keys and operational state" };
  }
  if (pathname === "/admin/users") return { title: "Users", subtitle: "Access governance and tenant assignments" };
  if (pathname === "/admin/health") return { title: "Platform Health", subtitle: "Infrastructure and tenant health evidence" };
  if (pathname === "/admin/audit") return { title: "Audit Log", subtitle: "Operator actions and evidence trail" };
  return { title: "Platform Admin", subtitle: "Administrative controls for Latero Control" };
}

function AdminNavItem({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
      style={
        active
          ? { background: "var(--color-sidebar-active-bg)", color: "var(--color-sidebar-active-text)" }
          : { color: "var(--color-sidebar-muted)" }
      }
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.background = "var(--color-sidebar-hover)";
          (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-foreground)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
          (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-sidebar-muted)";
        }
      }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function AdminUserMenu({ sessionEmail }: { sessionEmail: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as "light" | "dark") ?? "light";
    setTheme(stored);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      window.location.replace("/admin/login");
    }
  };

  const initials = sessionEmail.slice(0, 2).toUpperCase();
  const itemCls = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={sessionEmail}
        className="flex items-center gap-2.5 rounded-xl border px-2.5 py-1.5 transition-all hover:shadow-sm"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
          color: "var(--color-text)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{ background: "var(--color-brand)", color: "#fff" }}
        >
          {initials}
        </div>
        <div className="hidden text-left xl:block">
          <p className="max-w-[14rem] truncate text-sm font-semibold leading-none">{sessionEmail}</p>
          <p className="mt-0.5 text-xs leading-none" style={{ color: "var(--color-text-muted)" }}>
            Platform administrator
          </p>
        </div>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} style={{ color: "var(--color-text-muted)" }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border p-2 shadow-xl"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-dropdown)" }}
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold" style={{ color: "var(--color-text)" }}>{sessionEmail}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>Break-glass admin session</p>
          </div>

          <div className="my-1" style={{ borderTop: "1px solid var(--color-border)" }} />

          <Link href="/admin/users" className={itemCls} style={{ color: pathname === "/admin/users" ? "var(--color-brand)" : "var(--color-text)" }} onClick={() => setOpen(false)}>
            <UserCircle className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
            Users
          </Link>

          <button type="button" onClick={() => { toggleTheme(); setOpen(false); }} className={itemCls} style={{ color: "var(--color-text)" }}>
            {theme === "light"
              ? <Moon className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
              : <Sun className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />}
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>

          <div className="my-1" style={{ borderTop: "1px solid var(--color-border)" }} />

          <button type="button" onClick={handleLogout} className={itemCls} style={{ color: "var(--color-error)" }}>
            <LogOut className="h-4 w-4 shrink-0" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminShell({ children, sessionEmail }: AdminShellProps) {
  const pathname = usePathname();
  const header = getAdminHeader(pathname);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "var(--color-bg)" }}>
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col md:flex"
        style={{
          background: "var(--color-sidebar)",
          borderRight: "1px solid var(--color-sidebar-border)",
          color: "var(--color-sidebar-foreground)",
        }}
      >
        <div
          className="flex h-14 shrink-0 items-center px-3"
          style={{ borderBottom: "1px solid var(--color-sidebar-border)" }}
        >
          <Link
            href="/admin"
            className="flex h-14 min-w-0 flex-1 items-center gap-2.5 transition-opacity hover:opacity-80"
            aria-label="Latero Control Admin"
          >
            <img src="/logo/latero-mark-light.svg" alt="Latero" width={26} height={26} className="shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-none tracking-tight" style={{ color: "var(--color-brand, #1B3B6B)" }}>Latero</p>
              <p className="mt-0.5 truncate text-xs leading-none" style={{ color: "var(--color-text-subtle)" }}>Control</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-sidebar-muted)" }}>
            Platform
          </p>
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return <AdminNavItem key={item.href} href={item.href} label={item.label} Icon={item.icon} active={active} />;
            })}
          </div>
        </nav>
      </aside>

      <main className="min-h-screen pl-0 transition-[padding-left] duration-200 md:pl-[248px]">
        <header
          className="sticky top-0 z-20 hidden md:block"
          style={{
            background: "color-mix(in srgb, var(--color-bg) 92%, transparent)",
            backdropFilter: "blur(18px)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div className="mx-auto w-full max-w-[1600px] px-6 py-2 xl:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-medium leading-tight" style={{ color: "var(--color-text)" }}>
                  {header.title}
                </h1>
                <p className="truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {header.subtitle}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                <AdminUserMenu sessionEmail={sessionEmail} />
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1600px] px-6 py-3 xl:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
