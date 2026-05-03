"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ActivitySquare, Building2, Home, LogOut, Moon, Settings, Sun, Users } from "lucide-react";

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
    <div className="admin-theme min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-slate-900 dark:text-white" />
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white">Latero Control</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Admin</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="mb-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400">Logged in as:</p>
            <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{sessionEmail}</p>
          </div>
          <button
            onClick={toggleTheme}
            className="mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:opacity-80 transition-opacity"
            style={{color: 'var(--color-error)'}}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <main className="ml-64 min-h-screen p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}