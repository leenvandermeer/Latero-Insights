"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  Settings, Sun, Moon, LogOut, UserCircle,
  Building2, Check, Star, ChevronDown,
} from "lucide-react";
import { useInstallation } from "@/contexts/installation-context";
import type { Installation } from "@/contexts/installation-context";
import { cn } from "@/lib/utils";

// ── Env badge ─────────────────────────────────────────────────────────────────

function envStyle(env: string): React.CSSProperties {
  if (env === "production") return { background: "var(--color-error-subtle)", color: "var(--color-error)" };
  if (env === "staging")    return { background: "var(--color-warning-subtle)", color: "var(--color-warning)" };
  return { background: "var(--color-surface-alt)", color: "var(--color-text-muted)" };
}

// ── Installation switcher ─────────────────────────────────────────────────────

function InstallationSwitcher() {
  const { installation, installations, defaultInstallationId, switchInstallation, setDefaultInstallation, validating } = useInstallation();
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

  const isMulti = installations.length > 1;
  const label = installation.label ?? installation.installation_id;

  async function handleSwitch(inst: Installation) {
    if (inst.installation_id === installation!.installation_id) { setOpen(false); return; }
    setOpen(false);
    await switchInstallation(inst.installation_id);
  }

  async function handleSetDefault(e: React.MouseEvent, inst: Installation) {
    e.stopPropagation();
    if (settingDefault) return;
    setSettingDefault(inst.installation_id);
    await setDefaultInstallation(inst.installation_id);
    setSettingDefault(null);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => isMulti && setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
          isMulti && "cursor-pointer"
        )}
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
        onMouseEnter={(e) => { if (isMulti) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-alt)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface)"; }}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
        <span className="max-w-[120px] truncate">{label}</span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize shrink-0"
          style={envStyle(installation.environment)}
        >
          {installation.environment}
        </span>
        {isMulti && (
          <ChevronDown
            className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")}
            style={{ color: "var(--color-text-muted)" }}
          />
        )}
      </button>

      {isMulti && open && (
        <div
          className="absolute top-full right-0 mt-1.5 w-64 rounded-xl overflow-hidden shadow-lg z-50"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
            Switch environment
          </p>
          {installations.map((inst, i) => {
            const isActive   = inst.installation_id === installation.installation_id;
            const isDefault  = inst.installation_id === defaultInstallationId;
            const instLabel  = inst.label ?? inst.installation_id;
            return (
              <div
                key={inst.installation_id}
                role="button"
                tabIndex={validating ? -1 : 0}
                onClick={() => !validating && void handleSwitch(inst)}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !validating) void handleSwitch(inst); }}
                className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm cursor-pointer transition-colors"
                style={{
                  background: isActive ? "var(--color-surface-alt)" : "transparent",
                  borderTop: i === 0 ? "1px solid var(--color-border)" : "none",
                  color: "var(--color-text)",
                  opacity: validating ? 0.6 : 1,
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "var(--color-surface-alt)"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isActive
                    ? <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-brand)" }} />
                    : <span className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate font-medium">{instLabel}</span>
                  <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold capitalize shrink-0" style={envStyle(inst.environment)}>
                    {inst.environment}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => void handleSetDefault(e, inst)}
                  disabled={!!settingDefault}
                  title={isDefault ? "Default environment" : "Set as default"}
                  className="p-0.5 rounded transition-colors shrink-0 disabled:opacity-50"
                  style={{ color: isDefault ? "var(--color-warning)" : "var(--color-text-muted)" }}
                >
                  <Star className={cn("h-3.5 w-3.5", isDefault && "fill-current")} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── User menu ─────────────────────────────────────────────────────────────────

function UserAvatarMenu() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user } = useInstallation();
  const [open, setOpen]   = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const ref = useRef<HTMLDivElement>(null);
  const isAdmin = user?.is_admin ?? false;

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
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/");
    router.refresh();
  };

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "??";
  const itemCls  = "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left rounded-lg transition-colors";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={user?.email ?? "Account"}
        className="flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-80"
        style={{ background: "var(--color-brand)", color: "#fff" }}
      >
        <span className="text-[11px] font-semibold">{initials}</span>
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-1.5 w-56 rounded-xl p-1.5 shadow-xl z-50"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          {user?.email && (
            <div className="px-3 py-2">
              <p className="text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>{user.email}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{isAdmin ? "Admin" : "Member"}</p>
            </div>
          )}

          <div className="my-1" style={{ borderTop: "1px solid var(--color-border)" }} />

          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className={itemCls}
            style={{ color: "var(--color-text)", background: pathname === "/account" ? "var(--color-surface-alt)" : "transparent" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--color-surface-alt)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = pathname === "/account" ? "var(--color-surface-alt)" : "transparent"; }}
          >
            <UserCircle className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
            Account
          </Link>

          {isAdmin && (
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className={itemCls}
              style={{ color: "var(--color-text)", background: pathname === "/settings" ? "var(--color-surface-alt)" : "transparent" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--color-surface-alt)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = pathname === "/settings" ? "var(--color-surface-alt)" : "transparent"; }}
            >
              <Settings className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
              Settings
            </Link>
          )}

          <div className="my-1" style={{ borderTop: "1px solid var(--color-border)" }} />

          <button type="button" onClick={() => { toggleTheme(); setOpen(false); }} className={itemCls} style={{ color: "var(--color-text)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-alt)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            {theme === "light"
              ? <Moon className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
              : <Sun  className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />}
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>

          <div className="my-1" style={{ borderTop: "1px solid var(--color-border)" }} />

          <button type="button" onClick={handleLogout} className={itemCls} style={{ color: "var(--color-error)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-error-subtle)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────────

export function TopBar() {
  return (
    <div className="fixed top-3 right-4 z-40 hidden md:flex items-center gap-2">
      <InstallationSwitcher />
      <UserAvatarMenu />
    </div>
  );
}
