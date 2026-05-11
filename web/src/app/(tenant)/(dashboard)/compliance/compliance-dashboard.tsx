"use client";

import React, { useState } from "react";
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  Loader2,
  Play,
  Pencil,
  Trash2,
  LayoutGrid,
  List,
  Tag,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  usePolicies,
  useComplianceMatrix,
  useCreatePolicy,
  useUpdatePolicy,
  useDeletePolicy,
  useRunAllCompliance,
  useCellRunner,
  usePolicyPacks,
  useCreatePolicyPack,
  useUpdatePolicyPack,
  useDeletePolicyPack,
} from "@/hooks/use-compliance";
import type { VerdictValue, PolicyPack, Policy } from "@/hooks/use-compliance";

// ── Condition options (mirrors policy-engine.ts CONDITIONS) ──────────────────

const CONDITION_OPTIONS: {
  value: string;
  label: string;
  hasThreshold: boolean;
  thresholdLabel?: string;
  defaultThreshold?: number;
}[] = [
  { value: "owner_missing",           label: "Owner missing",                                  hasThreshold: false },
  { value: "sla_missing",             label: "SLA missing",                                    hasThreshold: false },
  { value: "contract_missing",        label: "Contract version missing",                       hasThreshold: false },
  { value: "no_lineage",              label: "No upstream lineage",                            hasThreshold: false },
  { value: "quality_below_threshold", label: "Quality pass-rate below threshold",              hasThreshold: true, thresholdLabel: "Min pass-rate (%)",    defaultThreshold: 95 },
  { value: "open_incidents",          label: "Open incidents above limit",                     hasThreshold: true, thresholdLabel: "Max open incidents",   defaultThreshold: 0  },
  { value: "volume_anomaly",          label: "Volume anomaly (% dev from 30-day avg)",        hasThreshold: true, thresholdLabel: "Max deviation (%)",    defaultThreshold: 30 },
  { value: "consumer_inactivity",     label: "Consumer inactivity (no access for N days)",    hasThreshold: true, thresholdLabel: "Max inactive days",    defaultThreshold: 30 },
  { value: "evidence_gap",            label: "Evidence gap (no evidence in last N days)",     hasThreshold: true, thresholdLabel: "Days to check",        defaultThreshold: 7  },
  { value: "temporal_coverage",       label: "Temporal coverage gap (longest gap > N days)",  hasThreshold: true, thresholdLabel: "Max gap (days)",       defaultThreshold: 7  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--color-surface-alt)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
};

const ACTION_BADGE_STYLE: Record<string, React.CSSProperties> = {
  block:  { background: "var(--color-error-subtle)",   color: "var(--color-error)"   },
  warn:   { background: "var(--color-warning-subtle)", color: "var(--color-warning)" },
  notify: { background: "var(--color-brand-subtle)",   color: "var(--color-brand)"   },
};

function conditionLabel(rule: Record<string, unknown>): string {
  const cond = rule?.condition as string | undefined;
  const opt = CONDITION_OPTIONS.find((c) => c.value === cond);
  if (!opt) return cond ?? "Custom";
  if (opt.hasThreshold && rule?.threshold !== undefined) {
    return `${opt.label} (${rule.threshold}${opt.thresholdLabel?.includes("%") ? "%" : ""})`;
  }
  return opt.label;
}

// ── Policy create/edit modal ──────────────────────────────────────────────────

interface PolicyModalProps {
  packs: PolicyPack[];
  initial?: Policy;
  onClose: () => void;
}

function PolicyModal({ packs, initial, onClose }: PolicyModalProps) {
  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();

  const initialCondition = (initial?.rule?.condition as string | undefined) ?? CONDITION_OPTIONS[0].value;
  const initialThreshold = (initial?.rule?.threshold as number | undefined)
    ?? CONDITION_OPTIONS.find((c) => c.value === initialCondition)?.defaultThreshold
    ?? 95;

  const [name, setName]                 = useState(initial?.name ?? "");
  const [conditionKey, setConditionKey] = useState(initialCondition);
  const [threshold, setThreshold]       = useState<number>(initialThreshold);
  const [action, setAction]             = useState<"warn" | "block" | "notify">(initial?.action ?? "warn");
  const [packId, setPackId]             = useState(initial?.pack_id ?? packs[0]?.id ?? "");
  const [error, setError]               = useState<string | null>(null);

  const conditionMeta = CONDITION_OPTIONS.find((c) => c.value === conditionKey);
  const isEdit = !!initial;
  const isPending = createPolicy.isPending || updatePolicy.isPending;

  const handleConditionChange = (val: string) => {
    setConditionKey(val);
    const meta = CONDITION_OPTIONS.find((c) => c.value === val);
    if (meta?.defaultThreshold !== undefined) setThreshold(meta.defaultThreshold);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setError(null);
    const rule: Record<string, unknown> = { subject: "product", condition: conditionKey };
    if (conditionMeta?.hasThreshold) rule.threshold = threshold;
    try {
      if (isEdit) {
        await updatePolicy.mutateAsync({ id: initial.id, name: name.trim(), rule, action, pack_id: packId || null });
      } else {
        await createPolicy.mutateAsync({ name: name.trim(), rule, scope: { all: true }, action, pack_id: packId || undefined });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {isEdit ? "Edit policy" : "New policy"}
        </h2>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Policy name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className={inputCls} style={INPUT_STYLE} placeholder="e.g. Owner required" />
        </div>

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Condition</label>
          <select value={conditionKey} onChange={(e) => handleConditionChange(e.target.value)}
            className={inputCls} style={INPUT_STYLE}>
            {CONDITION_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {conditionMeta?.hasThreshold && (
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
              {conditionMeta.thresholdLabel ?? "Threshold"}
            </label>
            <input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
              className={inputCls} style={INPUT_STYLE} min={0} />
          </div>
        )}

        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Action on fail</label>
          <select value={action} onChange={(e) => setAction(e.target.value as "warn" | "block" | "notify")}
            className={inputCls} style={INPUT_STYLE}>
            <option value="warn">Warn</option>
            <option value="block">Block</option>
            <option value="notify">Notify</option>
          </select>
        </div>

        {packs.length > 0 && (
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Policy pack (optional)</label>
            <select value={packId} onChange={(e) => setPackId(e.target.value)}
              className={inputCls} style={INPUT_STYLE}>
              <option value="">— None —</option>
              {packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {error && <p className="text-xs" style={{ color: "var(--color-error)" }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm"
            style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={isPending} className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--color-brand)", color: "var(--color-text-on-dark)" }}>
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Create policy"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Packs management modal ────────────────────────────────────────────────────

function PacksModal({ onClose }: { onClose: () => void }) {
  const { data: packs = [], isLoading } = usePolicyPacks();
  const createPack  = useCreatePolicyPack();
  const updatePack  = useUpdatePolicyPack();
  const deletePack  = useDeletePolicyPack();

  const [editingId, setEditingId]           = useState<string | null>(null);
  const [editName, setEditName]             = useState("");
  const [editFramework, setEditFramework]   = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newName, setNewName]               = useState("");
  const [newFramework, setNewFramework]     = useState("");
  const [createError, setCreateError]       = useState<string | null>(null);

  const inputCls   = "w-full rounded-lg px-3 py-2 text-sm outline-none";
  const inputStyle: React.CSSProperties = {
    background: "var(--color-surface-alt)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  };

  const startEdit = (pack: PolicyPack) => {
    setEditingId(pack.id);
    setEditName(pack.name);
    setEditFramework(pack.framework ?? "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updatePack.mutateAsync({ id: editingId, name: editName.trim(), framework: editFramework.trim() || undefined });
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!newName.trim()) { setCreateError("Name is required"); return; }
    setCreateError(null);
    await createPack.mutateAsync({ name: newName.trim(), framework: newFramework.trim() || undefined });
    setNewName("");
    setNewFramework("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Manage policy packs</h2>
          <button onClick={onClose} className="text-xs px-2 py-1 rounded"
            style={{ color: "var(--color-text-muted)" }}>Close</button>
        </div>

        <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          Policy packs group related policies together — e.g. by framework (BCBS-239, CSRD) or theme.
          Deleting a pack does not delete its policies; they become ungrouped.
        </p>

        {/* Existing packs */}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        )}

        {!isLoading && packs.length === 0 && (
          <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>No packs yet.</p>
        )}

        {!isLoading && packs.length > 0 && (
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
            {packs.map((pack) =>
              editingId === pack.id ? (
                <div key={pack.id} className="flex gap-2 items-center">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none" style={inputStyle}
                    placeholder="Pack name" />
                  <input value={editFramework} onChange={(e) => setEditFramework(e.target.value)}
                    className="w-28 rounded-lg px-3 py-1.5 text-sm outline-none" style={inputStyle}
                    placeholder="Framework" />
                  <button onClick={saveEdit} disabled={updatePack.isPending}
                    className="text-xs px-2 py-1.5 rounded-lg font-medium disabled:opacity-50"
                    style={{ background: "var(--color-brand)", color: "var(--color-text-on-dark)" }}>
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1.5 rounded-lg"
                    style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div key={pack.id} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{pack.name}</span>
                    {pack.framework && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: "var(--color-brand-subtle)", color: "var(--color-brand)" }}>
                        {pack.framework}
                      </span>
                    )}
                  </div>
                  {confirmDeleteId === pack.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs" style={{ color: "var(--color-error)" }}>Delete?</span>
                      <button onClick={() => deletePack.mutateAsync(pack.id).then(() => setConfirmDeleteId(null))}
                        disabled={deletePack.isPending}
                        className="text-xs px-2 py-1 rounded font-medium disabled:opacity-50"
                        style={{ background: "var(--color-error-subtle)", color: "var(--color-error)" }}>
                        Yes
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)}
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: "var(--color-surface)", color: "var(--color-text-muted)" }}>
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(pack)} title="Edit"
                        className="p-1.5 rounded" style={{ color: "var(--color-text-muted)" }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(pack.id)} title="Delete"
                        className="p-1.5 rounded" style={{ color: "var(--color-text-muted)" }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* Create new pack */}
        <div className="pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--color-text-muted)" }}>Add pack</p>
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              className={inputCls} style={inputStyle} placeholder="Pack name (required)" />
            <input value={newFramework} onChange={(e) => setNewFramework(e.target.value)}
              className="w-32 rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle}
              placeholder="Framework" />
            <button onClick={handleCreate} disabled={createPack.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium disabled:opacity-50 flex-shrink-0"
              style={{ background: "var(--color-brand)", color: "var(--color-text-on-dark)" }}>
              {createPack.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
              Add
            </button>
          </div>
          {createError && <p className="text-xs mt-1" style={{ color: "var(--color-error)" }}>{createError}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Policy list row ───────────────────────────────────────────────────────────

function PolicyRow({
  policy,
  products,
  verdictMap,
  packs,
  onEdit,
}: {
  policy: Policy;
  products: { data_product_id: string; display_name: string }[];
  verdictMap: Map<string, VerdictValue>;
  packs: PolicyPack[];
  onEdit: () => void;
}) {
  const deletePolicy = useDeletePolicy();
  const [confirmDelete, setConfirmDelete] = useState(false);

  let pass = 0, fail = 0, exception = 0, unknown = 0;
  for (const p of products) {
    const v = verdictMap.get(`${policy.id}:${p.data_product_id}`) ?? "unknown";
    if (v === "pass") pass++;
    else if (v === "fail") fail++;
    else if (v === "exception") exception++;
    else unknown++;
  }
  const total = products.length;

  const handleDelete = async () => {
    await deletePolicy.mutateAsync(policy.id);
    setConfirmDelete(false);
  };

  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center gap-4"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {/* Left: name + condition */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
            {policy.name}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize flex-shrink-0"
            style={ACTION_BADGE_STYLE[policy.action] ?? ACTION_BADGE_STYLE.notify}>
            {policy.action}
          </span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-subtle)" }}>
          {conditionLabel(policy.rule as Record<string, unknown>)}
        </p>
      </div>

      {/* Middle: verdict bar */}
      {total > 0 && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {fail > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--color-error)" }}>
              <XCircle className="h-3.5 w-3.5" />{fail}
            </span>
          )}
          {exception > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--color-warning)" }}>
              <AlertTriangle className="h-3.5 w-3.5" />{exception}
            </span>
          )}
          {pass > 0 && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-success)" }}>
              <CheckCircle2 className="h-3.5 w-3.5" />{pass}
            </span>
          )}
          {unknown === total && (
            <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>Not run yet</span>
          )}
          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>/ {total}</span>
        </div>
      )}

      {/* Right: actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {confirmDelete ? (
          <>
            <span className="text-xs mr-1" style={{ color: "var(--color-error)" }}>Delete?</span>
            <button
              onClick={handleDelete}
              disabled={deletePolicy.isPending}
              className="text-xs px-2 py-1 rounded font-medium disabled:opacity-50"
              style={{ background: "var(--color-error-subtle)", color: "var(--color-error)" }}
            >
              {deletePolicy.isPending ? "…" : "Yes"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs px-2 py-1 rounded"
              style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onEdit}
              title="Edit policy"
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete policy"
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Matrix cell ───────────────────────────────────────────────────────────────

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
        background: hovered && !running ? "var(--color-surface-alt)" : "transparent",
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
        <CheckCircle2 className="h-4 w-4" style={{ color: "var(--color-success)" }} />
      ) : verdict === "fail" ? (
        <XCircle className="h-4 w-4" style={{ color: "var(--color-error)" }} />
      ) : verdict === "exception" ? (
        <AlertTriangle className="h-4 w-4" style={{ color: "var(--color-warning)" }} />
      ) : (
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>—</span>
      )}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type ViewMode = "explorer" | "list" | "matrix";

export function ComplianceDashboard() {
  const [modalState, setModalState] = useState<{ open: boolean; policy?: Policy }>({ open: false });
  const [showPacksModal, setShowPacksModal] = useState(false);
  const [viewMode, setViewMode]     = useState<ViewMode>("explorer");
  const [explorerQuery, setExplorerQuery] = useState("");
  const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(new Set());

  const { data: policiesData }              = usePolicies();
  const { data: complianceData, isLoading } = useComplianceMatrix();
  const runAll                              = useRunAllCompliance();
  const { runningCells, localVerdicts, runCell, resetLocalVerdicts } = useCellRunner();

  const policies = policiesData?.policies   ?? [];
  const packs    = complianceData?.packs    ?? [];
  const products = complianceData?.products ?? [];
  const verdicts = complianceData?.verdicts ?? [];

  // Verdict lookup — local optimistic overrides take priority
  const verdictMap = new Map<string, VerdictValue>();
  for (const v of verdicts) verdictMap.set(`${v.policy_id}:${v.product_id}`, v.verdict);
  for (const [k, v] of localVerdicts) verdictMap.set(k, v);

  // Group policies by pack (for matrix view)
  const policyByPack = new Map<string | null, typeof policies>();
  for (const p of policies) {
    const key = p.pack_id ?? null;
    if (!policyByPack.has(key)) policyByPack.set(key, []);
    policyByPack.get(key)!.push(p);
  }

  // Product-centric stats
  // "Failing" = at least one explicit fail verdict
  // "Compliant" = has been run AND has no fail verdicts (may have exceptions/unknowns)
  const productsWithAnyRun = products.filter((p) =>
    policies.some((pol) => {
      const v = verdictMap.get(`${pol.id}:${p.data_product_id}`);
      return v === "pass" || v === "fail" || v === "exception";
    })
  );
  const productsFailing = products.filter((p) =>
    policies.some((pol) => verdictMap.get(`${pol.id}:${p.data_product_id}`) === "fail")
  );
  const productsCompliant = productsWithAnyRun.filter((p) =>
    !policies.some((pol) => verdictMap.get(`${pol.id}:${p.data_product_id}`) === "fail")
  );

  const handleRunAll = async () => {
    await runAll.mutateAsync();
    resetLocalVerdicts();
  };

  const hasData = policies.length > 0;
  const showMatrixToggle = hasData;

  return (
    <div className="page-content flex h-full flex-col overflow-x-hidden">

      {/* ── Stats hero ──────────────────────────────────────────────────────── */}
      {hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 mb-4">
          {[
            { label: "Active policies",   value: policies.length,           color: "var(--color-text)"    },
            { label: "Products in scope", value: products.length,           color: "var(--color-text)"    },
            { label: "No failures",       value: productsCompliant.length,  color: productsCompliant.length > 0 ? "var(--color-success)" : "var(--color-text)" },
            { label: "Has failures",      value: productsFailing.length,    color: productsFailing.length > 0 ? "var(--color-error)" : "var(--color-text)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl px-4 py-3"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>{label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Content card ────────────────────────────────────────────────────── */}
      <div
        className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        {/* Card header: tabs left, actions right */}
        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          {/* Tabs */}
          <div className="flex items-center gap-1">
            {([
              { id: "explorer", icon: <Search className="h-3.5 w-3.5" />, label: "Explorer" },
              { id: "list",     icon: <List className="h-3.5 w-3.5" />,   label: "Policies" },
              ...(showMatrixToggle ? [{ id: "matrix", icon: <LayoutGrid className="h-3.5 w-3.5" />, label: "Matrix" }] : []),
            ] as { id: ViewMode; icon: React.ReactNode; label: string }[]).map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: viewMode === id ? "var(--color-accent)" : "transparent",
                  color: viewMode === id ? "#fff" : "var(--color-text-muted)",
                }}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowPacksModal(true)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
            >
              <Tag className="h-3.5 w-3.5" />
              Packs
            </button>
            <button
              onClick={() => setModalState({ open: true })}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-text)", background: "var(--color-surface)" }}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              New policy
            </button>
            <button
              onClick={handleRunAll}
              disabled={runAll.isPending || !hasData}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium disabled:opacity-40 transition-opacity"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              {runAll.isPending
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Running…</>
                : <><RefreshCw className="h-3.5 w-3.5" />Run all checks</>
              }
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 p-6 text-sm" style={{ color: "var(--color-text-muted)" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {/* ── Explorer view ─────────────────────────────────────────────────── */}
        {!isLoading && hasData && viewMode === "explorer" && (() => {
          const q = explorerQuery.trim().toLowerCase();
          const filtered = policies.filter((pol) => {
            if (!q) return true;
            const pack = packs.find((pk) => pk.id === pol.pack_id);
            return (
              pol.name.toLowerCase().includes(q) ||
              conditionLabel(pol.rule as Record<string, unknown>).toLowerCase().includes(q) ||
              (pack?.name.toLowerCase().includes(q) ?? false)
            );
          });
          return (
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
              {/* Search bar */}
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "var(--color-text-muted)" }} />
                  <input
                    value={explorerQuery}
                    onChange={(e) => setExplorerQuery(e.target.value)}
                    placeholder="Search policies, conditions, packs…"
                    className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none"
                    style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                  />
                </div>
              </div>
              {/* Results */}
              <div className="flex flex-col overflow-auto flex-1">
                {filtered.length === 0 && (
                  <div className="flex items-center justify-center flex-1 p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    No policies match &ldquo;{explorerQuery}&rdquo;
                  </div>
                )}
                {filtered.map((pol) => {
                  const pack = packs.find((pk) => pk.id === pol.pack_id);
                  const isExpanded = expandedPolicies.has(pol.id);
                  let pass = 0, fail = 0, exception = 0, unknown = 0;
                  for (const p of products) {
                    const v = verdictMap.get(`${pol.id}:${p.data_product_id}`) ?? "unknown";
                    if (v === "pass") pass++;
                    else if (v === "fail") fail++;
                    else if (v === "exception") exception++;
                    else unknown++;
                  }
                  const total = products.length;
                  const allUnknown = unknown === total;
                  const passRate = total > 0 ? pass / total : 0;
                  return (
                    <div key={pol.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      {/* Policy header row */}
                      <button
                        type="button"
                        onClick={() => setExpandedPolicies((prev) => {
                          const next = new Set(prev);
                          isExpanded ? next.delete(pol.id) : next.add(pol.id);
                          return next;
                        })}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[rgba(128,128,128,0.04)]"
                      >
                        {/* Expand chevron */}
                        <span className="shrink-0" style={{ color: "var(--color-text-muted)" }}>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </span>
                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{pol.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize"
                              style={ACTION_BADGE_STYLE[pol.action] ?? ACTION_BADGE_STYLE.notify}>
                              {pol.action}
                            </span>
                            {pack && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                                style={{ background: "rgba(128,128,128,0.08)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
                                {pack.name}{pack.framework && ` · ${pack.framework}`}
                              </span>
                            )}
                          </div>
                          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            {conditionLabel(pol.rule as Record<string, unknown>)}
                          </p>
                        </div>
                        {/* Compliance summary */}
                        {total > 0 && (
                          <div className="flex items-center gap-3 shrink-0">
                            {/* Mini progress bar */}
                            <div className="hidden sm:block w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${passRate * 100}%`,
                                  background: fail > 0 ? "var(--color-error)" : passRate === 1 ? "var(--color-success)" : "var(--color-warning)",
                                }}
                              />
                            </div>
                            <div className="text-right min-w-[48px]">
                              {allUnknown ? (
                                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Not run</span>
                              ) : (
                                <>
                                  <span className="text-sm font-semibold tabular-nums" style={{ color: fail > 0 ? "var(--color-error)" : "var(--color-success)" }}>
                                    {pass}
                                  </span>
                                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}> / {total}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Edit button */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setModalState({ open: true, policy: pol }); }}
                          className="p-1.5 rounded shrink-0"
                          style={{ color: "var(--color-text-muted)" }}
                          title="Edit policy"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </button>
                      {/* Expanded: product chips */}
                      {isExpanded && (
                        <div className="px-10 pb-3 flex flex-wrap gap-1.5">
                          {products.map((prod) => {
                            const v = verdictMap.get(`${pol.id}:${prod.data_product_id}`) ?? "unknown";
                            const chipStyle: React.CSSProperties =
                              v === "pass"      ? { background: "rgba(16,185,129,0.10)",  color: "#059669",  border: "1px solid rgba(16,185,129,0.25)"  } :
                              v === "fail"      ? { background: "rgba(239,68,68,0.10)",   color: "#dc2626",  border: "1px solid rgba(239,68,68,0.25)"   } :
                              v === "exception" ? { background: "rgba(245,158,11,0.10)",  color: "#d97706",  border: "1px solid rgba(245,158,11,0.25)"  } :
                                                  { background: "rgba(128,128,128,0.08)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" };
                            return (
                              <span key={prod.data_product_id}
                                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-medium"
                                style={chipStyle}
                                title={prod.display_name}
                              >
                                {v === "pass"      ? <CheckCircle2 className="h-3 w-3 shrink-0" /> :
                                 v === "fail"      ? <XCircle className="h-3 w-3 shrink-0" /> :
                                 v === "exception" ? <AlertTriangle className="h-3 w-3 shrink-0" /> :
                                                     <span className="w-3 shrink-0 text-center text-[9px]">—</span>}
                                <span className="max-w-[120px] truncate">{prod.display_name}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Policy list view ──────────────────────────────────────────────── */}
        {!isLoading && hasData && viewMode === "list" && (
          <div className="flex flex-col gap-2 overflow-auto flex-1 p-4">
            {Array.from(policyByPack.entries()).map(([packId, packPolicies]) => {
              const pack = packs.find((pk) => pk.id === packId);
              return (
                <React.Fragment key={packId ?? "__none__"}>
                  {pack && (
                    <p className="text-[10px] font-semibold uppercase tracking-wide px-1 mt-2 mb-1"
                      style={{ color: "var(--color-text-subtle)" }}>
                      {pack.name}{pack.framework && <span className="ml-2 opacity-60">{pack.framework}</span>}
                    </p>
                  )}
                  {packPolicies.map((pol) => (
                    <PolicyRow
                      key={pol.id}
                      policy={pol}
                      products={products}
                      verdictMap={verdictMap}
                      packs={packs}
                      onEdit={() => setModalState({ open: true, policy: pol })}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* ── Matrix view ───────────────────────────────────────────────────── */}
        {!isLoading && hasData && viewMode === "matrix" && products.length > 0 && (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs border-collapse" style={{ minWidth: `${200 + products.length * 110}px` }}>
              <thead>
                <tr style={{ background: "var(--color-surface)" }}>
                  <th className="sticky left-0 z-10 text-left px-4 py-3 font-medium"
                    style={{ color: "var(--color-text-muted)", background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", minWidth: 220 }}>
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
                            style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}>
                            {pack.name}{pack.framework && <span className="ml-2 opacity-60">{pack.framework}</span>}
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
                                style={ACTION_BADGE_STYLE[pol.action] ?? ACTION_BADGE_STYLE.notify}>
                                {pol.action}
                              </span>
                              <button onClick={() => setModalState({ open: true, policy: pol })}
                                className="p-1 rounded flex-shrink-0"
                                style={{ color: "var(--color-text-subtle)" }} title="Edit">
                                <Pencil className="h-3 w-3" />
                              </button>
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

        {/* Matrix: no products yet */}
        {!isLoading && hasData && viewMode === "matrix" && products.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 p-8">
            <Shield className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No data products in scope yet.</p>
          </div>
        )}

        {/* Empty — no policies */}
        {!isLoading && !hasData && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 max-w-sm mx-auto text-center p-8">
            <div
              className="flex items-center justify-center w-12 h-12 rounded-xl"
              style={{ background: "rgba(128,128,128,0.08)", color: "var(--color-text-muted)" }}
            >
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-semibold mb-1.5" style={{ color: "var(--color-text)" }}>No policies yet</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                Policies define checks that run against your data products — e.g. "owner required",
                "quality pass-rate ≥ 95%", or "no open incidents". Once policies exist, run all
                checks to populate the compliance matrix.
              </p>
            </div>
            <button
              onClick={() => setModalState({ open: true })}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Create first policy
            </button>
          </div>
        )}
      </div>

      {modalState.open && (
        <PolicyModal
          packs={policiesData?.packs ?? []}
          initial={modalState.policy}
          onClose={() => setModalState({ open: false })}
        />
      )}

      {showPacksModal && (
        <PacksModal onClose={() => setShowPacksModal(false)} />
      )}
    </div>
  );
}
