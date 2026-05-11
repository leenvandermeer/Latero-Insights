"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Boxes,
  GitBranch,
  Package,
  ChevronDown,
  Check,
  LogOut,
  Moon,
  Settings,
  Shield,
  Star,
  Sun,
  TrendingUp,
  UserCircle,
  Building2,
} from "lucide-react";
import { useInstallation } from "@/contexts/installation-context";
import { useDateRange } from "@/hooks/use-date-range";
import type { Installation } from "@/contexts/installation-context";
import { cn } from "@/lib/utils";

function envStyle(env: string): React.CSSProperties {
  if (env === "production") return { background: "var(--color-error-subtle)", color: "var(--color-error)" };
  if (env === "staging") return { background: "var(--color-warning-subtle)", color: "var(--color-warning-text, var(--color-warning))" };
  return { background: "var(--color-brand-subtle)", color: "var(--color-brand)" };
}

function InstallationSwitcher({ compact = false }: { compact?: boolean }) {
  const {
    installation,
    installations,
    defaultInstallationId,
    switchInstallation,
    setDefaultInstallation,
    validating,
  } = useInstallation();
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
  const activeInstallationId = installation.installation_id;

  async function handleSwitch(inst: Installation) {
    if (inst.installation_id === activeInstallationId) {
      setOpen(false);
      return;
    }
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
    <div className="relative min-w-0" ref={ref}>
      <button
        type="button"
        onClick={() => isMulti && setOpen((value) => !value)}
        className={cn(
          compact
            ? "flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-all"
            : "flex min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-left transition-all",
          isMulti && "cursor-pointer hover:shadow-sm"
        )}
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
          color: "var(--color-text)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg",
            compact ? "h-7 w-7" : "h-8 w-8"
          )}
          style={{ background: "var(--color-brand-subtle)", color: "var(--color-brand)" }}
        >
          <Building2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </div>
        <div className="min-w-0">
          {!compact ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] leading-none" style={{ color: "var(--color-text-subtle)" }}>
              Installation
            </p>
          ) : null}
          <div className={cn("flex min-w-0 items-center gap-1.5", compact ? "" : "mt-0.5")}>
            <span className={cn("truncate font-semibold leading-none", compact ? "max-w-[7rem] text-xs" : "text-sm")}>{label}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
              style={envStyle(installation.environment)}
            >
              {installation.environment}
            </span>
          </div>
        </div>
        {isMulti && (
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
            style={{ color: "var(--color-text-muted)" }}
          />
        )}
      </button>

      {isMulti && open && (
        <div
          className={cn(
            "absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border shadow-xl",
            compact ? "w-[min(20rem,calc(100vw-2rem))]" : "w-[21rem]"
          )}
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-dropdown)" }}
        >
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-subtle)" }}>
              Switch installation
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
              Choose the active workspace for this session.
            </p>
          </div>

          <div className="max-h-[24rem] overflow-y-auto p-2">
            {installations.map((inst) => {
              const isActive = inst.installation_id === activeInstallationId;
              const isDefault = inst.installation_id === defaultInstallationId;
              const instLabel = inst.label ?? inst.installation_id;

              return (
                <div
                  key={inst.installation_id}
                  role="button"
                  tabIndex={validating ? -1 : 0}
                  onClick={() => !validating && void handleSwitch(inst)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !validating) void handleSwitch(inst);
                  }}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors"
                  style={{
                    background: isActive ? "var(--color-brand-subtle)" : "transparent",
                    color: "var(--color-text)",
                    opacity: validating ? 0.6 : 1,
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background: isActive ? "var(--color-brand)" : "var(--color-surface-alt)",
                        color: isActive ? "#fff" : "var(--color-text-muted)",
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold">{instLabel}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                          style={envStyle(inst.environment)}
                        >
                          {inst.environment}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {inst.installation_id}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => void handleSetDefault(e, inst)}
                    disabled={!!settingDefault}
                    title={isDefault ? "Default installation" : "Set as default"}
                    className="rounded-full p-2 transition-colors disabled:opacity-50"
                    style={{
                      background: isDefault ? "var(--color-accent-subtle)" : "transparent",
                      color: isDefault ? "var(--color-accent)" : "var(--color-text-muted)",
                    }}
                  >
                    <Star className={cn("h-3.5 w-3.5", isDefault && "fill-current")} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function UserAvatarMenu({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useInstallation();
  const [open, setOpen] = useState(false);
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
  const itemCls = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors";

  return (
    <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          title={user?.email ?? "Account"}
          className={cn(
            "flex items-center rounded-xl border transition-all hover:shadow-sm",
            compact ? "gap-2 px-2 py-1.5" : "gap-2.5 px-2.5 py-1.5"
          )}
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
          color: "var(--color-text)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          className={cn(
            "flex items-center justify-center rounded-full text-[11px] font-semibold",
            compact ? "h-7 w-7" : "h-8 w-8"
          )}
          style={{ background: "var(--color-brand)", color: "#fff" }}
        >
          {initials}
        </div>
        <div className={cn("text-left", compact ? "hidden" : "hidden xl:block")}>
          <p className="max-w-[12rem] truncate text-sm font-semibold leading-none">{user?.email ?? "Account"}</p>
          <p className="mt-0.5 text-xs leading-none" style={{ color: "var(--color-text-muted)" }}>
            {isAdmin ? "Administrator" : "Member"}
          </p>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          style={{ color: "var(--color-text-muted)" }}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 top-full z-50 mt-2 rounded-2xl border p-2 shadow-xl",
            compact ? "w-[min(18rem,calc(100vw-2rem))]" : "w-64"
          )}
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-dropdown)" }}
        >
          {user?.email && (
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold" style={{ color: "var(--color-text)" }}>{user.email}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>{isAdmin ? "Administrator" : "Member"}</p>
            </div>
          )}

          <div className="my-1" style={{ borderTop: "1px solid var(--color-border)" }} />

          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className={itemCls}
            style={{ color: pathname === "/account" ? "var(--color-brand)" : "var(--color-text)" }}
          >
            <UserCircle className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
            Account
          </Link>

          {isAdmin && (
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className={itemCls}
              style={{ color: pathname === "/settings" ? "var(--color-brand)" : "var(--color-text)" }}
            >
              <Settings className="h-4 w-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
              Settings
            </Link>
          )}

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

export function TopBar() {
  const pathname = usePathname();
  const overviewRange = useDateRange({ scope: "monitor:overview", defaultPreset: "7d" });
  const qualityRange = useDateRange({ scope: "monitor:quality", defaultPreset: "7d" });
  const runsRange = useDateRange({ scope: "monitor:runs", defaultPreset: "7d" });

  const pageHeader = (() => {
    if (pathname === "/overview") return { title: "Estate Health", subtitle: `Current state with run and quality signals for ${overviewRange.summaryLabel}`, icon: Boxes };
    if (pathname === "/quality") return { title: "Data Quality", subtitle: `Showing ${qualityRange.summaryLabel}`, icon: Shield };
    if (pathname === "/runs") return { title: "Runs", subtitle: `Showing ${runsRange.summaryLabel}`, icon: Activity };
    if (pathname === "/incidents") return { title: "Issues", subtitle: "Detected and reported trust issues for data products", icon: Shield };
    if (pathname === "/compliance") return { title: "Compliance", subtitle: "Policy checks across your data estate", icon: Shield };
    if (pathname === "/products") return { title: "Data Products", subtitle: "Browse operational products and surface governance gaps quickly.", icon: Package };
    if (pathname === "/catalog") return { title: "Catalog", subtitle: "Data products, entities, and datasets", icon: Package };
    if (pathname === "/lineage") return { title: "Lineage", subtitle: "Upstream, downstream and column-level relationships across the estate", icon: GitBranch };
    if (pathname === "/changes") return { title: "Change Intelligence", subtitle: "Detected drift and change events across your data estate", icon: TrendingUp };
    if (pathname === "/impact") return { title: "Business Impact", subtitle: "Business outputs and downstream impact analysis", icon: TrendingUp };
    if (pathname === "/consumers") return { title: "Consumers", subtitle: "Demand-side analytics per data product", icon: UserCircle };
    if (pathname === "/dashboard") return { title: "Dashboards", subtitle: "Personal and shared operational views", icon: Package };
    if (pathname.startsWith("/dashboard/")) return { title: "Dashboard", subtitle: "Configurable view with date scope for period-based widgets", icon: Package };
    return null;
  })();
  const MobileIcon = pageHeader?.icon;

  return (
    <>
      {pageHeader ? (
        <div className="page-content pb-1 pt-4 md:hidden">
          <div className="space-y-3">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--color-brand-subtle)", color: "var(--color-brand)" }}
              >
                {MobileIcon ? <MobileIcon className="h-4 w-4" /> : null}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-medium leading-tight" style={{ color: "var(--color-text)" }}>
                  {pageHeader.title}
                </h1>
                <p className="mt-1 text-sm leading-snug" style={{ color: "var(--color-text-muted)" }}>
                  {pageHeader.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <InstallationSwitcher compact />
              <UserAvatarMenu compact />
            </div>
          </div>
        </div>
      ) : null}

      <header
        className="sticky top-0 z-20 hidden md:block"
        style={{
          background: "color-mix(in srgb, var(--color-bg) 92%, transparent)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="page-content py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              {pageHeader ? (
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-medium leading-tight" style={{ color: "var(--color-text)" }}>
                    {pageHeader.title}
                  </h1>
                  <p className="truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {pageHeader.subtitle}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2.5">
              <InstallationSwitcher />
              <UserAvatarMenu />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
