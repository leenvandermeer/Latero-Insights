"use client";

import { useState } from "react";
import { Shield, CheckCircle2, XCircle, AlertTriangle, RefreshCw, PlusCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// WP-404 — all supported condition types (mirrors policy-engine.ts CONDITIONS)
// ---------------------------------------------------------------------------
const CONDITION_OPTIONS: { value: string; label: string; hasThreshold: boolean; thresholdLabel?: string; defaultThreshold?: number }[] = [
  { value: "owner_missing",         label: "Owner missing",                   hasThreshold: false },
  { value: "sla_missing",           label: "SLA missing",                     hasThreshold: false },
  { value: "contract_missing",      label: "Contract version missing",        hasThreshold: false },
  { value: "no_lineage",            label: "No upstream lineage",             hasThreshold: false },
  { value: "quality_below_threshold", label: "Quality pass-rate below threshold", hasThreshold: true, thresholdLabel: "Min pass-rate (%)", defaultThreshold: 95 },
  { value: "open_incidents",        label: "Open incidents above limit",      hasThreshold: true, thresholdLabel: "Max open incidents", defaultThreshold: 0 },
  // WP-404 additions
  { value: "volume_anomaly",        label: "Volume anomaly (% deviation from 30-day avg)", hasThreshold: true, thresholdLabel: "Max deviation (%)", defaultThreshold: 30 },
  { value: "consumer_inactivity",   label: "Consumer inactivity (no access for N days)",  hasThreshold: true, thresholdLabel: "Max inactive days", defaultThreshold: 30 },
  { value: "evidence_gap",          label: "Evidence gap (no evidence in last N days)",    hasThreshold: true, thresholdLabel: "Days to check", defaultThreshold: 7 },
  { value: "temporal_coverage",     label: "Temporal coverage gap (longest gap > N days)", hasThreshold: true, thresholdLabel: "Max gap (days)", defaultThreshold: 7 },
];
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Policy {
  id: string;
  name: string;
  action: "warn" | "block" | "notify";
  pack_id: string | null;
  active: boolean;
  fail_count?: number;
  pass_count?: number;
  last_evaluated_at?: string | null;
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
  pack_id?: string | null;
  policy_name?: string;
}

interface ComplianceProduct {
  data_product_id: string;
  display_name: string;
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed");
  return res.json() as Promise<T>;
}

// ── Verdict cell ──────────────────────────────────────────────────────────────

function VerdictCell({ verdict }: { verdict: "pass" | "fail" | "exception" | "unknown" }) {
  if (verdict === "pass") return <CheckCircle2 className="h-4 w-4 mx-auto" style={{ color: "#16a34a" }} />;
  if (verdict === "fail") return <XCircle className="h-4 w-4 mx-auto" style={{ color: "#dc2626" }} />;
  if (verdict === "exception") return <AlertTriangle className="h-4 w-4 mx-auto" style={{ color: "#ca8a04" }} />;
  return <span className="text-xs mx-auto block text-center" style={{ color: "var(--color-text-muted)" }}>—</span>;
}

// ── Run policy modal ──────────────────────────────────────────────────────────

function RunPolicyModal({ policies, products, onClose }: {
  policies: Policy[];
  products: ComplianceProduct[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [policyId, setPolicyId] = useState(policies[0]?.id ?? "");
  const [productId, setProductId] = useState(products[0]?.data_product_id ?? "");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ verdict: string; detail: Record<string, unknown> } | null>(null);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/compliance/${encodeURIComponent(productId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy_id: policyId }),
      });
      const body = await res.json() as { data?: { verdict: string; detail: Record<string, unknown> } };
      if (body.data) setResult(body.data);
      qc.invalidateQueries({ queryKey: ["compliance"] });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Run Policy Check</h2>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Policy</label>
          <select value={policyId} onChange={(e) => setPolicyId(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Product</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            {products.map((p) => <option key={p.data_product_id} value={p.data_product_id}>{p.display_name}</option>)}
          </select>
        </div>

        {result && (
          <div className="p-3 rounded-lg" style={{
            background: result.verdict === "pass" ? "#dcfce7" : "#fee2e2",
          }}>
            <p className="text-sm font-semibold capitalize" style={{ color: result.verdict === "pass" ? "#166534" : "#b91c1c" }}>
              {result.verdict}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
            Close
          </button>
          <button onClick={handleRun} disabled={running} className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--color-brand)", color: "#fff" }}>
            {running ? "Running…" : "Run check"}
          </button>
        </div>
      </div>
    </div>
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
    setSaving(true);
    setError(null);
    try {
      const rule: Record<string, unknown> = { subject: "product", condition: conditionKey };
      if (conditionMeta?.hasThreshold) rule.threshold = threshold;
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          rule,
          scope: { all: true },
          action,
          pack_id: packId || null,
        }),
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

  const selectCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
  const selectStyle = { background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" };

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
            className={selectCls} style={selectStyle} placeholder="e.g. Owner required" />
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Condition</label>
          <select value={conditionKey} onChange={(e) => handleConditionChange(e.target.value)}
            className={selectCls} style={selectStyle}>
            {CONDITION_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {conditionMeta?.hasThreshold && (
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
              {conditionMeta.thresholdLabel ?? "Threshold"}
            </label>
            <input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
              className={selectCls} style={selectStyle} min={0} />
          </div>
        )}

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Action on fail</label>
          <select value={action} onChange={(e) => setAction(e.target.value as "warn" | "block" | "notify")}
            className={selectCls} style={selectStyle}>
            <option value="warn">Warn</option>
            <option value="block">Block</option>
            <option value="notify">Notify</option>
          </select>
        </div>

        {packs.length > 0 && (
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Policy pack (optional)</label>
            <select value={packId} onChange={(e) => setPackId(e.target.value)}
              className={selectCls} style={selectStyle}>
              <option value="">— None —</option>
              {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {error && <p className="text-xs" style={{ color: "#b91c1c" }}>{error}</p>}

        <div className="flex gap-2">
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
  const [showRunModal, setShowRunModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  // Build verdict lookup: policy_id + product_id → verdict
  const verdictMap = new Map<string, "pass" | "fail" | "exception">();
  for (const v of verdicts) {
    verdictMap.set(`${v.policy_id}:${v.product_id}`, v.verdict);
  }

  // Group policies by pack
  const policyByPack = new Map<string | null, Policy[]>();
  for (const p of policies) {
    const key = p.pack_id ?? null;
    if (!policyByPack.has(key)) policyByPack.set(key, []);
    policyByPack.get(key)!.push(p);
  }

  // Stats
  const failCount = verdicts.filter((v) => v.verdict === "fail").length;
  const passCount = verdicts.filter((v) => v.verdict === "pass").length;
  const exceptionCount = verdicts.filter((v) => v.verdict === "exception").length;
  const totalPolicies = policies.length;

  return (
    <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>Compliance</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Policy verdicts across your data estate
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            New policy
          </button>
          <button
            onClick={() => setShowRunModal(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: "var(--color-brand)", color: "#fff" }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Run check
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Policies", value: totalPolicies, color: "var(--color-text)" },
          { label: "Pass", value: passCount, color: "#166534" },
          { label: "Fail", value: failCount, color: "#b91c1c" },
          { label: "Exceptions", value: exceptionCount, color: "#a16207" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</p>
            <p className="text-2xl font-bold tabular-nums mt-1" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Compliance matrix */}
      {isLoading && <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</p>}
      {!isLoading && policies.length > 0 && products.length > 0 && (
        <div className="flex-1 overflow-auto rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
          <table className="w-full text-xs border-collapse" style={{ minWidth: `${160 + products.length * 100}px` }}>
            <thead>
              <tr style={{ background: "var(--color-surface)" }}>
                <th className="text-left px-3 py-2 font-medium sticky left-0 z-10"
                  style={{ color: "var(--color-text-muted)", background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
                  Policy
                </th>
                {products.map((p) => (
                  <th key={p.data_product_id} className="px-2 py-2 font-medium text-center whitespace-nowrap"
                    style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
                    <span className="block max-w-[90px] truncate mx-auto" title={p.display_name}>
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
                  <>
                    {pack && (
                      <tr key={`pack-${packId}`}>
                        <td colSpan={products.length + 1} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ background: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}>
                          {pack.name}
                          {pack.framework && <span className="ml-1 opacity-60">· {pack.framework}</span>}
                        </td>
                      </tr>
                    )}
                    {packPolicies.map((pol) => (
                      <tr key={pol.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td className="px-3 py-2 sticky left-0 z-10"
                          style={{ background: "var(--color-surface)", color: "var(--color-text)" }}>
                          <span className="block max-w-[140px] truncate" title={pol.name}>{pol.name}</span>
                          <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                            {pol.action}
                          </span>
                        </td>
                        {products.map((prod) => {
                          const verdict = verdictMap.get(`${pol.id}:${prod.data_product_id}`) ?? "unknown";
                          return (
                            <td key={prod.data_product_id} className="px-2 py-2">
                              <VerdictCell verdict={verdict} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && policies.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <Shield className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            No policies configured yet.
          </p>
        </div>
      )}

      {showRunModal && (
        <RunPolicyModal
          policies={policies}
          products={products}
          onClose={() => setShowRunModal(false)}
        />
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
