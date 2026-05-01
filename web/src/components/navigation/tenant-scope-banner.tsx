"use client";

import { useState } from "react";
import { Building2, Check, ChevronsUpDown, ShieldCheck } from "lucide-react";
import { useInstallation } from "@/contexts/installation-context";
import { cn } from "@/lib/utils";

export function TenantScopeBanner({ className }: { className?: string }) {
  const { installation, installations, switchInstallation, validating, user } = useInstallation();
  const [open, setOpen] = useState(false);

  if (!installation) {
    return null;
  }

  const installationLabel = installation.label ?? installation.installation_id;
  const multiTenant = installations.length > 1;

  return (
    <div className={cn("flex justify-end", className)}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5"
          style={{
            border: "1px solid var(--color-border)",
            background: "var(--color-card)",
            color: "var(--color-text)",
          }}
          aria-label="Open organization menu"
          title="Organization"
        >
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-md"
            style={{ background: "var(--color-brand-subtle, rgba(27,59,107,0.1))" }}
          >
            <Building2 className="h-3.5 w-3.5" style={{ color: "var(--color-brand, #1B3B6B)" }} />
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
        </button>

        {open && (
          <div
            className="absolute right-0 top-11 z-40 w-[280px] rounded-xl p-3 shadow-xl"
            style={{
              border: "1px solid var(--color-border)",
              background: "var(--color-card)",
            }}
          >
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                Current organization
              </p>
              <p className="truncate text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                {installationLabel}
              </p>
              <p className="truncate text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                {installation.installation_id}
              </p>
            </div>

            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium" style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}>
              <ShieldCheck className="h-3.5 w-3.5" />
              {user?.is_admin ? "Admin session" : "Tenant user session"}
            </div>

            {multiTenant ? (
              <div className="space-y-1.5">
                {installations.map((org) => {
                  const active = org.installation_id === installation.installation_id;
                  return (
                    <button
                      key={org.installation_id}
                      type="button"
                      onClick={() => {
                        void switchInstallation(org.installation_id);
                        setOpen(false);
                      }}
                      disabled={validating}
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm disabled:opacity-60"
                      style={{
                        background: active ? "var(--color-brand-subtle, rgba(27,59,107,0.1))" : "transparent",
                        color: "var(--color-text)",
                      }}
                    >
                      <span className="truncate">{org.label ?? org.installation_id}</span>
                      {active ? <Check className="h-3.5 w-3.5" style={{ color: "var(--color-brand, #1B3B6B)" }} /> : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                This user has access to one organization.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
