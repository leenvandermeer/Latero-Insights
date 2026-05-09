"use client";

import React, { useState, useCallback } from "react";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, PlusCircle, Loader2, Play,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// ── Condition options (mirrors policy-engine.ts CONDITIONS) ──────────────────

const CONDITION_OPTIONS: {
  value: string; label: string; hasThreshold: boolean;
  thresholdLabel?: string; defaultThreshold?: number;
}[] = [
  { value: "owner_missing",           label: "Owner missing",                                   hasThreshold: false },
  { value: "sla_missing",             label: "SLA missing",                                     hasThreshold: false },
  { value: "contract_missing",        label: "Contract version missing",                        hasThreshold: false },
  { value: "no_lineage",              label: "No upstream lineage",                             hasThreshold: false },
  { value: "quality_below_threshold", label: "Quality pass-rate below threshold",               hasThreshold: true, thresholdLabel: "Min pass-rate (%)", defaultThreshold: 95 },
  { value: "open_incidents",          label: "Open incidents above limit",                      hasThreshold: true, thresholdLabel: "Max open incidents", defaultThreshold: 0 },
  { value: "volume_anomaly",          label: "Volume anomaly (% deviation from 30-day avg)",   hasThreshold: true, thresholdLabel: "Max deviation (%)", defaultThreshold: 30 },
  { value: "consumer_inactivity",     label: "Consumer inactivity (no access for N days)",     hasThreshold: true, thresholdLabel: "Max inactive days", defaultThreshold: 30 },
  { value: "evidence_gap",            label: "Evidence gap (no evidence in last N days)",       hasThreshold: true, thresholdLabel: "Days to check", defaultThreshold: 7 },
  { value: "temporal_coverage",       label: "Temporal coverage gap (longest gap > N days)",   hasThreshold: true, thresholdLabel: "Max gap (days)", defaultThreshold: 7 },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Policy {
  id: string;
  name: string;
  action: "warn" | "block" | "notify";
  pack_id: string | null;
  active: boolean;
}

interface PolicyPack {
  id: string;
  name: string;
  framework: string | null;
}

interface PolicyVerdict {
  policy_id: string;
  product_id: string;
  verdict: "pass" | "fail" | "exception";
}

interface ComplianceProduct {
  data_product_id: string;
  display_name: string;
}

type VerdictValue = "pass" | "fail" | "exception" | "unknown";

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error("Request failed");
  return res.json() as Promise<T>;
}

// ── Interactive matrix cell ───────────────────────────────────────────────────

function MatrixCell({
  verdict,
  running,
  onRun,
}: {
  verdict: VerdictValue;
  running: boolean;
  onRun: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onRun}
      disabled={running}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={running ? "Running…" : `${verdict === "unknown" ? "No data" : verdict} — click to re-run`}
      className="w-full flex items-center justify-center rounded transition-colors disabled:cursor-default"
      style={{
        background: hovered && !running ? "var(--color-surface-raised)" : "transparent",
        minHeight: 34,
        cursor: running ? "default" : "pointer",
        border: "none",
        outline: "none",
      }}
    >
      {running ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--color-text-muted)" }} />
      ) : hovered ? (
        <Play className="h-3.5 w-3.5" style={{ color: "var(--color-brand)" }} />
      ) : verdict === "pass" ? (
        <CheckCircle2 className="h-4 w-4" style={{ color: "#16a34a" }} />
      ) : verdict === "fail" ? (
        <XCircle className="h-4 w-4" style={{ color: "#dc2626" }} />
      ) : verdict === "exception" ? (
        <AlertTriangle className="h-4 w-4" style={{ color: "#ca8a04" }} />
      ) : (
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>—</span>
      )}
    </button>
  );
}

// ── Create Policy Modal ───────────────────────────────────────────────────────

function CreatePolicyModal({ packs, onClose }: { packs: PolicyPack[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [conditionKey, setConditionKey] = useState(CONDITION_OPTIONS[0].value);
  const [threshold, setThreshold] = useState<number>(CONDITION_OPTIONS[0].defaultThreshold ?? 95);
  const [action, setAction] = useState<"warn" | "block" | "notify">("warn");
  const [packId, setPackId] = useState(packs[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conditionMeta = CONDITION_OPTIONS.find((c) => c.value === conditionKey);

  const handleConditionChange = (val: string) => {
    setConditionKey(val);
    const meta = CONDITION_OPTIONS.find((c) => c.value === val);
    if (meta?.defaultThreshold !== undefined) setThreshold(meta.defaultThreshold);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError(null);
    try {
      const rule: Record<string, unknown> = { subject: "product", condition: conditionKey };
      if (conditionMeta?.hasThreshold) rule.threshold = threshold;
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), rule, scope: { all: true }, action, pack_id: packId || null }),
      });
      if (!res.ok) { const b = await res.json() as { error?: string }; throw new Error(b.error ?? "Failed"); }
      qc.invalidateQueries({ queryKey: ["policies"] });
      qc.invalidateQueries({ queryKey: ["compliance"] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
  const inputStyle = { background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>New Policy</h2>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Policy name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className={inputCls} style={inputStyle} placeholder="e.g. Owner required" />
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Condition</label>
          <select value={conditionKey} onChange={(e) => handleConditionChange(e.target.value)}
            className={inputCls} style={inputStyle}>
            {CONDITION_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {conditionMeta?.hasThreshold && (
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
              {conditionMeta.thresholdLabel ?? "Threshold"}
            </label>
            <input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
              className={inputCls} style={inputStyle} min={0} />
          </div>
        )}

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Action on fail</label>
          <select value={action} onChange={(e) => setAction(e.target.value as "warn" | "block" | "notify")}
            className={inputCls} style={inputStyle}>
            <option value="warn">Warn</option>
            <option value="block">Block</option>
            <option value="notify">Notify</option>
          </select>
        </div>

        {packs.length > 0 && (
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Policy pack (optional)</label>
            <select value={packId} onChange={(e) => setPackId(e.target.value)}
              className={inputCls} style={inputStyle}>
              <option value="">— None —</option>
              {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {error && <p className="text-xs" style={{ color: "#b91c1c" }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--color-brand)", color: "#fff" }}>
            {saving ? "Saving…" : "Create policy"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ComplianceDashboard() {
  const qc = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [runningCells, setRunningCells] = useState<Set<string>>(new Set());
  const [localVerdicts, setLocalVerdicts] = useState<Map<string, VerdictValue>>(new Map());

  const { data: policiesResponse } = useQuery({
    queryKey: ["policies"],
    queryFn: () => apiFetch<{ data: { policies: Policy[]; packs: PolicyPack[] } }>("/api/policies")
      .then((r) => r.data ?? { policies: [], packs: [] }),
    staleTime: 60_000,
    retry: 1,
  });

  const { data: complianceResponse, isLoading } = useQuery({
    queryKey: ["compliance"],
    queryFn: () => apiFetch<{ data: { verdicts: PolicyVerdict[]; products: ComplianceProduct[]; packs: PolicyPack[] } }>("/api/compliance")
      .then((r) => r.data ?? { verdicts: [], products: [], packs: [] }),
    staleTime: 30_000,
    retry: 1,
  });

  const policies = policiesResponse?.policies ?? [];
  const packs = complianceResponse?.packs ?? [];
  const products = complianceResponse?.products ?? [];
  const verdicts = complianceResponse?.verdicts ?? [];

  // Verdict lookup — local optimistic overrides take priority
  const verdictMap = new Map<string, VerdictValue>();
  for (const v of verdicts) verdictMap.set(`${v.policy_id}:${v.product_id}`, v.verdict);
  for (const [k, v] of localVerdicts) verdictMap.set(k, v);

  // Group policies by pack
  const policyByPack = new Map<string | null, Policy[]>();
  for (const p of policies) {
    const key = p.pack_id ?? null;
    if (!policyByPack.has(key)) policyByPack.set(key, []);
    policyByPack.get(key)!.push(p);
  }

  const allValues = Array.from(verdictMap.values());
  const passCount      = allValues.filter((v) => v === "pass").length;
  const failCount      = allValues.filter((v) => v === "fail").length;
  const exceptionCount = allValues.filter((v) => v === "exception").length;

  // Single cell run
  const runCell = useCallback(async (policyId: string, productId: string) => {
    const key = `${policyId}:${productId}`;
    setRunningCells((prev) => { const s = new Set(prev); s.add(key); return s; });
    try {
      const body = await apiFetch<{ data?: { verdict: string } }>(
        `/api/compliance/${encodeURIComponent(productId)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ policy_id: policyId }) }
      );
      if (body.data?.verdict) {
        setLocalVerdicts((prev) => new Map(prev).set(key, body.data!.verdict as VerdictValue));
      }
    } catch { /* keep previous verdict */ } finally {
      setRunningCells((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  }, []);

  // Run all checks
  const runAll = useCallback(async () => {
    setRunningAll(true);
    try {
      await apiFetch("/api/compliance", { method: "POST" });
      setLocalVerdicts(new Map());
      await qc.invalidateQueries({ queryKey: ["compliance"] });
    } finally {
      setRunningAll(false);
    }
  }, [qc]);

  return (
    <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>Compliance</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Policy verdicts across your data estate — click any cell to re-run that check
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            New policy
          </button>
          <button
            onClick={runAll}
            disabled={runningAll}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-opacity"
            style={{ background: "var(--color-brand)", color: "#fff" }}
          >
            {runningAll
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />&nbsp;Running…</>
              : <><RefreshCw className="h-3.5 w-3.5" />&nbsp;Run all checks</>
            }
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Policies",   value: policies.length, color: "var(--color-text)" },
          { label: "Pass",       value: passCount,        color: "#166534" },
          { label: "Fail",       value: failCount,        color: "#b91c1c" },
          { label: "Exceptions", value: exceptionCount,   color: "#a16207" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</p>
            <p className="text-2xl font-bold tabular-nums mt-1" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" /> Loading compliance matrix…
        </div>
      )}

      {/* Matrix */}
      {!isLoading && policies.length > 0 && products.length > 0 && (
        <div className="flex-1 overflow-auto rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
          <table className="w-full text-xs border-collapse" style={{ minWidth: `${200 + products.length * 110}px` }}>
            <thead>
              <tr style={{ background: "var(--color-surface)" }}>
                <th className="sticky left-0 z-10 text-left px-4 py-3 font-medium"
                  style={{ color: "var(--color-text-muted)", background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", minWidth: 200 }}>
                  Policy
                </th>
                {products.map((p) => (
                  <th key={p.data_product_id} className="px-3 py-3 font-medium text-center"
                    style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)", minWidth: 110 }}>
                    <span className="block max-w-[100px] truncate mx-auto" title={p.display_name}>
                      {p.display_name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(policyByPack.entries()).map(([packId, packPolicies]) => {
                const pack = packs.find((pk) => pk.id === packId);
                return (
                  <React.Fragment key={packId ?? "__none__"}>
                    {pack && (
                      <tr>
                        <td colSpan={products.length + 1}
                          className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ background: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}>
                          {pack.name}
                          {pack.framework && <span className="ml-2 opacity-60">{pack.framework}</span>}
                        </td>
                      </tr>
                    )}
                    {packPolicies.map((pol) => (
                      <tr key={pol.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td className="sticky left-0 z-10 px-4 py-2"
                          style={{ background: "var(--color-surface)", color: "var(--color-text)" }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate text-xs font-medium flex-1" title={pol.name}>{pol.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 capitalize"
                              style={{
                                background: pol.action === "block" ? "#fee2e2" : pol.action === "warn" ? "#fef9c3" : "#dbeafe",
                                color: pol.action === "block" ? "#b91c1c" : pol.action === "warn" ? "#a16207" : "#1d4ed8",
                              }}>
                              {pol.action}
                            </span>
                          </div>
                        </td>
                        {products.map((prod) => {
                          const key = `${pol.id}:${prod.data_product_id}`;
                          return (
                            <td key={prod.data_product_id} className="px-1 py-0.5">
                              <MatrixCell
                                verdict={verdictMap.get(key) ?? "unknown"}
                                running={runningCells.has(key)}
                                onRun={() => runCell(pol.id, prod.data_product_id)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && policies.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <Shield className="h-10 w-10" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No policies configured yet.</p>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: "var(--color-brand)", color: "#fff" }}>
            <PlusCircle className="h-3.5 w-3.5" />
            Create first policy
          </button>
        </div>
      )}

      {showCreateModal && (
        <CreatePolicyModal
          packs={policiesResponse?.packs ?? []}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
