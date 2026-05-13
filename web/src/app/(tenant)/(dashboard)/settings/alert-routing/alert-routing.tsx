"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataProducts, DataProduct } from "@/hooks/use-data-products";

const CHANGE_TYPES = [
  { value: "schema_drift",      label: "Schema drift" },
  { value: "contract_drift",    label: "Contract drift" },
  { value: "ownership_drift",   label: "Ownership drift" },
  { value: "statistical_drift", label: "Statistical drift" },
  { value: "lineage_drift",     label: "Lineage drift" },
];

const SEVERITIES = [
  { value: "breaking",      label: "Breaking" },
  { value: "significant",   label: "Significant" },
  { value: "informational", label: "Informational" },
];

interface RoutingRule {
  id: string;
  name: string;
  conditions: {
    type?: string;
    domain?: string;
    severity?: string;
    product_id?: string;
  };
  actions: {
    notify?: string;
    digest_batch_id?: string;
  };
  priority: number;
  active: boolean;
}

function newRule(): RoutingRule {
  return {
    id: crypto.randomUUID(),
    name: "New rule",
    conditions: {},
    actions: {},
    priority: 0,
    active: true,
  };
}

function RuleEditor({ rule, onChange, onDelete, domains, products }: {
  rule: RoutingRule;
  onChange: (r: RoutingRule) => void;
  onDelete: () => void;
  domains: string[];
  products: { id: string; label: string }[];
}) {
  const inputStyle: React.CSSProperties = {
    background: "var(--color-surface-raised)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
    borderRadius: "8px",
    padding: "4px 8px",
    fontSize: "12px",
    outline: "none",
    width: "100%",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: "none" as React.CSSProperties["appearance"],
    cursor: "pointer",
  };

  return (
    <div className="rounded-xl p-4 flex gap-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <GripVertical className="h-4 w-4 mt-1 shrink-0" style={{ color: "var(--color-text-muted)" }} />

      <div className="flex-1 flex flex-col gap-3">
        {/* Name + active + priority */}
        <div className="flex items-center gap-2">
          <input
            value={rule.name}
            onChange={(e) => onChange({ ...rule, name: e.target.value })}
            style={{ ...inputStyle, flexGrow: 1 }}
            placeholder="Rule name"
          />
          <label className="flex items-center gap-1 text-xs whitespace-nowrap select-none" style={{ color: "var(--color-text-muted)" }}>
            <input type="checkbox" checked={rule.active} onChange={(e) => onChange({ ...rule, active: e.target.checked })} />
            Active
          </label>
          <input
            type="number"
            value={rule.priority}
            onChange={(e) => onChange({ ...rule, priority: parseInt(e.target.value, 10) || 0 })}
            style={{ ...inputStyle, width: "56px" }}
            title="Priority (lower = evaluated first)"
            placeholder="0"
          />
        </div>

        {/* Conditions */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>
            Conditions
          </p>
          <div className="grid grid-cols-2 gap-2">
            {/* Type */}
            <div>
              <label className="text-[10px] mb-0.5 block" style={{ color: "var(--color-text-muted)" }}>Change type</label>
              <select
                value={rule.conditions.type ?? ""}
                onChange={(e) => onChange({ ...rule, conditions: { ...rule.conditions, type: e.target.value || undefined } })}
                style={selectStyle}
              >
                <option value="">Any type</option>
                {CHANGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="text-[10px] mb-0.5 block" style={{ color: "var(--color-text-muted)" }}>Severity</label>
              <select
                value={rule.conditions.severity ?? ""}
                onChange={(e) => onChange({ ...rule, conditions: { ...rule.conditions, severity: e.target.value || undefined } })}
                style={selectStyle}
              >
                <option value="">Any severity</option>
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Domain */}
            <div>
              <label className="text-[10px] mb-0.5 block" style={{ color: "var(--color-text-muted)" }}>Domain</label>
              <select
                value={rule.conditions.domain ?? ""}
                onChange={(e) => onChange({ ...rule, conditions: { ...rule.conditions, domain: e.target.value || undefined } })}
                style={selectStyle}
              >
                <option value="">Any domain</option>
                {domains.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Product */}
            <div>
              <label className="text-[10px] mb-0.5 block" style={{ color: "var(--color-text-muted)" }}>Product</label>
              <select
                value={rule.conditions.product_id ?? ""}
                onChange={(e) => onChange({ ...rule, conditions: { ...rule.conditions, product_id: e.target.value || undefined } })}
                style={selectStyle}
              >
                <option value="">Any product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>
            Actions
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] mb-0.5 block" style={{ color: "var(--color-text-muted)" }}>Notify (email / channel)</label>
              <input
                value={rule.actions.notify ?? ""}
                onChange={(e) => onChange({ ...rule, actions: { ...rule.actions, notify: e.target.value || undefined } })}
                style={inputStyle}
                placeholder="data-team@example.com"
                type="email"
              />
            </div>
            <div>
              <label className="text-[10px] mb-0.5 block" style={{ color: "var(--color-text-muted)" }}>Digest batch ID</label>
              <input
                value={rule.actions.digest_batch_id ?? ""}
                onChange={(e) => onChange({ ...rule, actions: { ...rule.actions, digest_batch_id: e.target.value || undefined } })}
                style={inputStyle}
                placeholder="e.g. daily-digest"
              />
            </div>
          </div>
        </div>
      </div>

      <button onClick={onDelete} className="p-1.5 self-start rounded-lg hover:opacity-80"
        style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)" }}>
        <Trash2 className="h-3.5 w-3.5" style={{ color: "#dc2626" }} />
      </button>
    </div>
  );
}

export function AlertRoutingSettings() {
  const qc = useQueryClient();
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: allProducts } = useDataProducts();
  const productList: DataProduct[] = allProducts ?? [];
  const domains = [...new Set(productList.map((p) => p.domain).filter((d): d is string => d != null))];
  const products = productList.map((p) => ({ id: p.data_product_id, label: p.display_name }));

  const { data, isLoading } = useQuery({
    queryKey: ["alert-routing-rules"],
    queryFn: () =>
      fetch("/api/settings/alert-routing").then((r) => r.json())
        .then((b: { data: RoutingRule[] }) => b.data),
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (data) { setRules(data); setDirty(false); }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      fetch("/api/settings/alert-routing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alert-routing-rules"] });
      setDirty(false);
    },
  });

  const updateRule = (idx: number, updated: RoutingRule) => {
    setRules((rs) => rs.map((r, i) => (i === idx ? updated : r)));
    setDirty(true);
  };

  const deleteRule = (idx: number) => {
    setRules((rs) => rs.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const addRule = () => {
    setRules((rs) => [...rs, { ...newRule(), priority: rs.length }]);
    setDirty(true);
  };

  return (
    <div className="page-content flex flex-col gap-6 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-medium leading-tight" style={{ color: "var(--color-text)" }}>Alert Routing Rules</h1>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            Define conditions and actions for routing alerts. Rules are evaluated by priority (lowest first).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={addRule}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
            <Plus className="h-3.5 w-3.5" /> Add rule
          </button>
          <button onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
            style={{ background: "var(--color-brand)", color: "#fff" }}>
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving…" : "Save rules"}
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading rules…</p>}

      {rules.length === 0 && !isLoading && (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          No routing rules configured. Add a rule to get started.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {rules.map((rule, idx) => (
          <RuleEditor
            key={rule.id}
            rule={rule}
            onChange={(r) => updateRule(idx, r)}
            onDelete={() => deleteRule(idx)}
            domains={domains}
            products={products}
          />
        ))}
      </div>

      {saveMutation.isError && (
        <p className="text-xs" style={{ color: "#dc2626" }}>Failed to save rules. Please try again.</p>
      )}
    </div>
  );
}
