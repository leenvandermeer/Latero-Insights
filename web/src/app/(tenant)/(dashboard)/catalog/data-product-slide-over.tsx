"use client";

import { useDeferredValue, useState, useEffect } from "react";
import { X, Check, ChevronDown } from "lucide-react";
import {
  useCreateDataProduct,
  useUpdateDataProduct,
  type DataProduct,
  type DataProductInput,
} from "@/hooks/use-data-products";
import { useEntities } from "@/hooks/use-entities";

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  initialValues?: DataProduct;
}

type SLATier = "bronze" | "silver" | "gold";

// ── Entity multi-select ──────────────────────────────────────────────────────

function EntityPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data } = useEntities();
  const entities: { entity_id: string; display_name: string }[] =
    (data?.data ?? []) as { entity_id: string; display_name: string }[];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filteredEntities = entities.filter((entity) => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      entity.display_name.toLowerCase().includes(q) ||
      entity.entity_id.toLowerCase().includes(q)
    );
  });

  const toggle = (id: string) => {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full rounded-lg px-3 py-2 text-sm text-left"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: selected.length ? "var(--color-text)" : "var(--color-text-muted)",
        }}
      >
        <span className="truncate">
          {selected.length === 0
            ? "Select entities…"
            : `${selected.length} selected`}
        </span>
        <ChevronDown className="h-3.5 w-3.5 ml-2 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute z-20 w-full mt-1 rounded-lg shadow-lg overflow-auto"
            style={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              maxHeight: 200,
            }}
          >
            <div style={{ borderBottom: "1px solid var(--color-border)" }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search entities…"
                className="w-full bg-transparent px-3 py-2 text-sm outline-none"
                style={{ color: "var(--color-text)" }}
              />
            </div>
            {entities.length === 0 && (
              <p className="px-3 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                No entities available
              </p>
            )}
            {entities.length > 0 && filteredEntities.length === 0 && (
              <p className="px-3 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                No entities match your search
              </p>
            )}
            {filteredEntities.map((e) => {
              const checked = selected.includes(e.entity_id);
              return (
                <button
                  key={e.entity_id}
                  type="button"
                  onClick={() => toggle(e.entity_id)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left"
                  style={{
                    background: checked ? "var(--color-surface)" : "transparent",
                    color: "var(--color-text)",
                  }}
                >
                  <span
                    className="flex-shrink-0 h-4 w-4 rounded flex items-center justify-center"
                    style={{
                      background: checked ? "var(--color-brand)" : "transparent",
                      border: checked ? "none" : "1px solid var(--color-border)",
                    }}
                  >
                    {checked && <Check className="h-2.5 w-2.5 text-white" />}
                  </span>
                  <span className="truncate">{e.display_name || e.entity_id}</span>
                  <span className="ml-auto font-mono text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    {e.entity_id}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Field ────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
  error,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
        {label}{required && <span style={{ color: "var(--color-error)" }}> *</span>}
      </label>
      {children}
      {error && <p className="text-xs" style={{ color: "var(--color-error)" }}>{error}</p>}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const cls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
  const style = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  };
  if (multiline)
    return (
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cls}
        style={style}
      />
    );
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cls}
      style={style}
    />
  );
}

// ── Slide-over ───────────────────────────────────────────────────────────────

const EMPTY: DataProductInput = {
  display_name: "",
  description: "",
  owner: "",
  data_steward: "",
  domain: "",
  classification: null,
  retention_days: null,
  sla_tier: null,
  entity_ids: [],
};

export function DataProductSlideOver({ open, onClose, initialValues }: Props) {
  const isEdit = !!initialValues;
  const createMutation = useCreateDataProduct();
  const updateMutation = useUpdateDataProduct(initialValues?.data_product_id ?? "");

  const [form, setForm] = useState<DataProductInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(
        initialValues
          ? {
              display_name:   initialValues.display_name,
              description:    initialValues.description ?? "",
              owner:          initialValues.owner ?? "",
              data_steward:   initialValues.data_steward ?? "",
              domain:         initialValues.domain ?? "",
              classification: initialValues.classification ?? null,
              retention_days: initialValues.retention_days ?? null,
              sla_tier:       initialValues.sla_tier ?? null,
              entity_ids:     initialValues.entity_ids,
            }
          : EMPTY
      );
      setErrors({});
    }
  }, [open, initialValues]);

  const set = <K extends keyof DataProductInput>(k: K, v: DataProductInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.display_name.trim()) errs.display_name = "Name is required";
    if ((form.entity_ids ?? []).length === 0) errs.entity_ids = "Select at least one entity";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: DataProductInput = {
      display_name:   form.display_name.trim(),
      description:    form.description || undefined,
      owner:          (form.owner ?? "").trim() || null,
      data_steward:   (form.data_steward ?? "").trim() || null,
      domain:         (form.domain ?? "").trim() || undefined,
      classification: form.classification ?? null,
      retention_days: form.retention_days ?? null,
      sla_tier:       form.sla_tier ?? null,
      entity_ids:     form.entity_ids,
    };

    try {
      if (isEdit) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch {
      // mutation error surfaces via isPending/isError on the mutation
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error?.message ?? updateMutation.error?.message;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{
          background: "rgba(0,0,0,0.4)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: 420,
          background: "var(--color-card)",
          borderLeft: "1px solid var(--color-border)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease",
          boxShadow: open ? "-8px 0 32px rgba(0,0,0,0.15)" : "none",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {isEdit ? "Edit data product" : "New data product"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded"
            style={{ color: "var(--color-text-muted)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form id="dp-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          <Field label="Name" required error={errors.display_name}>
            <TextInput
              value={form.display_name}
              onChange={(v) => set("display_name", v)}
              placeholder="e.g. Labour Market Analytics"
            />
          </Field>

          <Field label="Description">
            <TextInput
              value={form.description ?? ""}
              onChange={(v) => set("description", v)}
              placeholder="What does this product contain?"
              multiline
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner">
              <TextInput
                value={form.owner ?? ""}
                onChange={(v) => set("owner", v)}
                placeholder="team or person"
              />
            </Field>
            <Field label="Data steward">
              <TextInput
                value={form.data_steward ?? ""}
                onChange={(v) => set("data_steward", v)}
                placeholder="e.g. jane.doe@bank.nl"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Domain">
              <TextInput
                value={form.domain ?? ""}
                onChange={(v) => set("domain", v)}
                placeholder="e.g. HR"
              />
            </Field>
            <Field label="Classification">
              <select
                value={form.classification ?? ""}
                onChange={(e) => set("classification", (e.target.value as DataProductInput["classification"]) || null)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                <option value="">— Not set —</option>
                <option value="public">Public</option>
                <option value="internal">Internal</option>
                <option value="confidential">Confidential</option>
                <option value="restricted">Restricted</option>
              </select>
            </Field>
          </div>

          <Field label="Retention (days)">
            <input
              type="number"
              min={1}
              value={form.retention_days ?? ""}
              onChange={(e) => set("retention_days", e.target.value ? Number(e.target.value) : null)}
              placeholder="e.g. 365"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
          </Field>

          <Field label="SLA tier">
            <div className="flex gap-2">
              {(["bronze", "silver", "gold"] as SLATier[]).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => set("sla_tier", form.sla_tier === tier ? null : tier)}
                  className="flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition-colors"
                  style={
                    form.sla_tier === tier
                      ? { background: "var(--color-warning-subtle)", color: "var(--color-warning)", border: "none" }
                      : {
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text-muted)",
                        }
                  }
                >
                  {tier}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Entities" required error={errors.entity_ids}>
            <EntityPicker
              selected={form.entity_ids ?? []}
              onChange={(ids) => set("entity_ids", ids)}
            />
          </Field>

          {mutationError && (
            <p className="text-xs" style={{ color: "var(--color-error)" }}>{mutationError}</p>
          )}
        </form>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 px-5 py-4"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="dp-form"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--color-brand)" }}
          >
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
    </>
  );
}
