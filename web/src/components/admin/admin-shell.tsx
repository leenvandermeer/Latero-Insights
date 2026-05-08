"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ActivitySquare, Building2, Home, LogOut, Moon, ShieldCheck, Sun, Users } from "lucide-react";

interface AdminShellProps {
  children: ReactNode;
  sessionEmail: string;
}

export function AdminShell({ children, sessionEmail }: AdminShellProps) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const storedTheme = (localStorage.getItem("theme") as "light" | "dark") ?? "light";
    setTheme(storedTheme);
    document.documentElement.setAttribute("data-theme", storedTheme);
  }, []);

  const navItems = [
    { href: "/admin", label: "Overview", icon: Home, exact: true },
    { href: "/admin/installations", label: "Installations", icon: Building2 },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/health", label: "Health", icon: ActivitySquare },
    { href: "/admin/audit", label: "Audit Log", icon: Activity },
  ];

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/admin/login";
  };

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  return (
    <div className="admin-theme min-h-screen">
      <aside
        className="fixed left-0 top-0 z-40 h-screen w-72 border-r"
        style={{
          background: "var(--color-admin-sidebar)",
          borderColor: "var(--color-border)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div className="border-b p-6" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{ background: "var(--color-brand-subtle)", color: "var(--color-brand)" }}
            >
              <img
                src="/logo/latero-mark-light.svg"
                alt="Latero"
                width={28}
                height={28}
                className="block [html[data-theme=dark]_&]:hidden"
              />
              <img
                src="/logo/latero-mark-dark.svg"
                alt=""
                width={28}
                height={28}
                className="hidden [html[data-theme=dark]_&]:block"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-none tracking-tight" style={{ color: "var(--color-brand, #1B3B6B)" }}>
                Latero
              </p>
              <p className="mt-0.5 truncate text-xs leading-none" style={{ color: "var(--color-text-subtle)" }}>
                Control
              </p>
              <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: "var(--color-text-subtle)" }}>
                Platform Admin
              </p>
            </div>
          </div>
          <div
            className="mt-5 rounded-2xl border p-4"
            style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--color-accent-subtle)", color: "var(--color-accent)" }}
              >
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-subtle)" }}>
                  Break-glass session
                </p>
                <p className="mt-1 truncate text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  {sessionEmail}
                </p>
              </div>
            </div>
          </div>
        </div>

        <nav className="space-y-5 p-4">
          <div>
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-subtle)" }}>
              Platform
            </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="mb-1.5 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors"
                style={
                  isActive
                    ? { background: "var(--color-admin-active-bg)", color: "var(--color-admin-active-text)" }
                    : { color: "var(--color-text-muted)" }
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          </div>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t p-4" style={{ borderColor: "var(--color-border)" }}>
          <button
            onClick={toggleTheme}
            className="mb-2 flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium"
            style={{ color: "var(--color-text-muted)" }}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--color-error)" }}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <main className="ml-72 min-h-screen px-6 py-6 xl:px-8">
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
