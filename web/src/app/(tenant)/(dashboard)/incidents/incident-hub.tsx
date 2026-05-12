"use client";

import { useState, useEffect, useRef } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, Plus, X, Search,
  ChevronRight, FileText, ListChecks, Paperclip, User,
  Calendar, Timer, Tag, ExternalLink,
} from "lucide-react";
import {
  useIncidents,
  useIncident,
  useCreateIncident,
  useUpdateIncident,
  useAddStep,
  useAddEvidence,
} from "@/hooks/use-incidents";
import type { Incident, IncidentDetail, CreateIncidentInput } from "@/hooks/use-incidents";

// ── Style maps ────────────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<string, { bg: string; text: string }> = {
  critical: { bg: "#fee2e2", text: "#b91c1c" },
  high:     { bg: "#ffedd5", text: "#c2410c" },
  medium:   { bg: "#fef9c3", text: "#a16207" },
  low:      { bg: "#f0f9ff", text: "#0369a1" },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  open:        { bg: "#fee2e2", text: "#b91c1c" },
  in_progress: { bg: "#fef9c3", text: "#a16207" },
  resolved:    { bg: "#dcfce7", text: "#166534" },
};

const SOURCE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  manual:           { bg: "#e0f2fe", text: "#0369a1", label: "Reported" },
  alert:            { bg: "#dcfce7", text: "#166534", label: "Detected" },
  policy_violation: { bg: "#fef3c7", text: "#a16207", label: "Policy" },
};

function Badge({ style, label }: { style: { bg: string; text: string }; label: string }) {
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize whitespace-nowrap"
      style={{ background: style.bg, color: style.text }}
    >
      {label}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function fmtDuration(start: string, end: string | null) {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Create modal ──────────────────────────────────────────────────────────────

function CreateIncidentModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<CreateIncidentInput>({ title: "", severity: "medium" });
  const createMutation = useCreateIncident();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await createMutation.mutateAsync(form);
    onClose();
  };

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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>New incident</h2>
          <button onClick={onClose}><X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Title *</label>
            <input
              required
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              placeholder="Brief description of the incident"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Severity</label>
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as CreateIncidentInput["severity"] }))}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Source</label>
              <select
                value={form.source_type ?? "manual"}
                onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value as CreateIncidentInput["source_type"] }))}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                <option value="manual">Reported</option>
                <option value="alert">Detected</option>
                <option value="policy_violation">Policy</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Assignee</label>
            <input
              type="text"
              value={form.assignee ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value || undefined }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              placeholder="Optional assignee"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--color-brand)", color: "#fff" }}
            >
              {createMutation.isPending ? "Creating…" : "Create incident"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Step progress bar ─────────────────────────────────────────────────────────

function StepProgress({ total, done }: { total: number; done: number }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-1.5 min-w-[60px]">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: pct === 100 ? "#166534" : "var(--color-brand)" }}
        />
      </div>
      <span className="text-[10px] tabular-nums" style={{ color: "var(--color-text-muted)" }}>
        {done}/{total}
      </span>
    </div>
  );
}

// ── Detail slide-over ─────────────────────────────────────────────────────────

type DetailTab = "steps" | "evidence";

function IncidentSlideOver({ incidentId, onClose }: { incidentId: number; onClose: () => void }) {
  const { data: detail, isLoading } = useIncident(incidentId);
  const updateMutation = useUpdateIncident();
  const addStep = useAddStep();
  const addEvidence = useAddEvidence();

  const [tab, setTab] = useState<DetailTab>("steps");
  const [stepLabel, setStepLabel] = useState("");
  const [evidenceType, setEvidenceType] = useState("note");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [addingStep, setAddingStep] = useState(false);
  const [addingEvidence, setAddingEvidence] = useState(false);

  const stepInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleAdvance = async () => {
    if (!detail) return;
    const next = detail.status === "open" ? "in_progress" : "resolved";
    await updateMutation.mutateAsync({ id: detail.id, status: next });
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stepLabel.trim() || !detail) return;
    setAddingStep(true);
    try {
      await addStep.mutateAsync({ incidentId: detail.id, label: stepLabel.trim() });
      setStepLabel("");
      stepInputRef.current?.focus();
    } finally {
      setAddingStep(false);
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceNote.trim() || !detail) return;
    setAddingEvidence(true);
    try {
      await addEvidence.mutateAsync({
        incidentId: detail.id,
        evidence_type: evidenceType,
        payload: { note: evidenceNote.trim() },
      });
      setEvidenceNote("");
    } finally {
      setAddingEvidence(false);
    }
  };

  const sev = detail ? (SEVERITY_STYLE[detail.severity] ?? SEVERITY_STYLE.low) : SEVERITY_STYLE.low;
  const sts = detail ? (STATUS_STYLE[detail.status] ?? STATUS_STYLE.open) : STATUS_STYLE.open;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.3)" }}
        onClick={onClose}
      />

      {/* Panel — 480px on desktop, bottom sheet on mobile */}
      <div
        className="fixed z-50 flex flex-col overflow-hidden"
        style={{
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          // Desktop: right panel
          right: 0,
          top: 0,
          bottom: 0,
          width: "clamp(320px, 480px, 100vw)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start gap-3 p-5 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="h-5 w-48 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
            ) : (
              <>
                <h2 className="text-sm font-semibold leading-snug mb-2" style={{ color: "var(--color-text)" }}>
                  {detail?.title}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {detail && (
                    <>
                      <Badge style={sev} label={detail.severity} />
                      <Badge style={sts} label={detail.status.replace("_", " ")} />
                      {detail.source_type && (
                        <Badge
                          style={SOURCE_STYLE[detail.source_type] ?? SOURCE_STYLE.manual}
                          label={SOURCE_STYLE[detail.source_type]?.label ?? detail.source_type}
                        />
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="flex-shrink-0 p-1 rounded-lg" style={{ color: "var(--color-text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Meta grid */}
        {detail && (
          <div
            className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 py-3 border-b text-xs"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
          >
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>Opened {fmtDate(detail.created_at)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Timer className="h-3 w-3 flex-shrink-0" />
              <span>{fmtDuration(detail.created_at, detail.resolved_at)} {detail.status === "resolved" ? "(total)" : "open"}</span>
            </div>
            {detail.assignee && (
              <div className="flex items-center gap-1.5 col-span-2">
                <User className="h-3 w-3 flex-shrink-0" />
                <span>{detail.assignee}</span>
              </div>
            )}
            {detail.product_id && (
              <div className="flex items-center gap-1.5 col-span-2">
                <Tag className="h-3 w-3 flex-shrink-0" />
                <span className="font-mono">{detail.product_id}</span>
              </div>
            )}
          </div>
        )}

        {/* Advance status button */}
        {detail && detail.status !== "resolved" && (
          <div className="px-5 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
            <button
              onClick={handleAdvance}
              disabled={updateMutation.isPending}
              className="w-full py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-opacity"
              style={{ background: "var(--color-brand)", color: "#fff" }}
            >
              {updateMutation.isPending
                ? "Updating…"
                : detail.status === "open"
                ? "Mark in progress →"
                : "Mark resolved ✓"}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b px-5" style={{ borderColor: "var(--color-border)" }}>
          {(["steps", "evidence"] as DetailTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex items-center gap-1.5 px-2 py-3 text-xs font-medium mr-4"
              style={{
                color: tab === t ? "var(--color-brand)" : "var(--color-text-muted)",
                borderBottom: tab === t ? "2px solid var(--color-brand)" : "2px solid transparent",
                marginBottom: "-1px",
                background: "transparent",
              }}
            >
              {t === "steps" ? <ListChecks className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
              {t === "steps" ? "Actions" : "Evidence"}
              {detail && t === "steps" && detail.step_count > 0 && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{ background: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}
                >
                  {detail.steps_completed}/{detail.step_count}
                </span>
              )}
              {detail && t === "evidence" && detail.evidence.length > 0 && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{ background: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}
                >
                  {detail.evidence.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-5 flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: "var(--color-border)" }} />
              ))}
            </div>
          )}

          {/* Actions tab */}
          {!isLoading && detail && tab === "steps" && (
            <div className="p-5 flex flex-col gap-3">
              {/* Steps list */}
              {detail.steps.length === 0 && (
                <p className="text-xs py-2" style={{ color: "var(--color-text-muted)" }}>
                  No actions logged yet. Log the first remediation action below.
                </p>
              )}
              {detail.steps.map((step) => (
                <div key={step.id} className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="h-4 w-4 flex-shrink-0 mt-0.5"
                    style={{ color: step.completed_at ? "#166534" : "var(--color-text-muted)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs" style={{ color: "var(--color-text)" }}>{step.label}</p>
                    {step.completed_at && (
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                        {step.completed_by ? `${step.completed_by} · ` : ""}
                        {fmtDate(step.completed_at)}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {/* Add step form */}
              {detail.status !== "resolved" && (
                <form
                  onSubmit={handleAddStep}
                  className="flex gap-2 mt-1 pt-3 border-t"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <input
                    ref={stepInputRef}
                    type="text"
                    value={stepLabel}
                    onChange={(e) => setStepLabel(e.target.value)}
                    placeholder="Log an action taken…"
                    className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
                    style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                  />
                  <button
                    type="submit"
                    disabled={addingStep || !stepLabel.trim()}
                    className="px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
                    style={{ background: "var(--color-brand)", color: "#fff" }}
                  >
                    Log
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Evidence tab */}
          {!isLoading && detail && tab === "evidence" && (
            <div className="p-5 flex flex-col gap-3">
              {detail.evidence.length === 0 && (
                <p className="text-xs py-2" style={{ color: "var(--color-text-muted)" }}>
                  No evidence attached. Add a note or reference below.
                </p>
              )}
              {detail.evidence.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-xl p-3 flex flex-col gap-1"
                  style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)" }}
                >
                  <div className="flex items-center gap-1.5 justify-between">
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
                    >
                      {ev.evidence_type}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                      {fmtDate(ev.attached_at)}
                    </span>
                  </div>
                  {"note" in ev.payload ? (
                    <p className="text-xs" style={{ color: "var(--color-text)" }}>
                      {ev.payload.note as string}
                    </p>
                  ) : (
                    <pre className="text-[10px] whitespace-pre-wrap" style={{ color: "var(--color-text-muted)" }}>
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  )}
                  {"url" in ev.payload && (
                    <a
                      href={ev.payload.url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs"
                      style={{ color: "var(--color-brand)" }}
                    >
                      <ExternalLink className="h-3 w-3" /> Open link
                    </a>
                  )}
                </div>
              ))}

              {/* Add evidence form */}
              {detail.status !== "resolved" && (
                <form
                  onSubmit={handleAddEvidence}
                  className="flex flex-col gap-2 mt-1 pt-3 border-t"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <select
                    value={evidenceType}
                    onChange={(e) => setEvidenceType(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                    style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                  >
                    <option value="note">Note</option>
                    <option value="query_result">Query result</option>
                    <option value="runbook">Runbook reference</option>
                    <option value="screenshot">Screenshot reference</option>
                    <option value="external_link">External link</option>
                  </select>
                  <div className="flex gap-2">
                    <textarea
                      value={evidenceNote}
                      onChange={(e) => setEvidenceNote(e.target.value)}
                      placeholder="Add a note or reference…"
                      rows={2}
                      className="flex-1 rounded-lg px-3 py-2 text-xs outline-none resize-none"
                      style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                    />
                    <button
                      type="submit"
                      disabled={addingEvidence || !evidenceNote.trim()}
                      className="px-3 rounded-lg text-xs font-medium disabled:opacity-40 self-stretch"
                      style={{ background: "var(--color-brand)", color: "#fff" }}
                    >
                      Add
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Incident row ──────────────────────────────────────────────────────────────

function IncidentRow({ incident, onClick }: { incident: Incident; onClick: () => void }) {
  const sev = SEVERITY_STYLE[incident.severity] ?? SEVERITY_STYLE.low;
  const sts = STATUS_STYLE[incident.status] ?? STATUS_STYLE.open;
  const source = SOURCE_STYLE[incident.source_type ?? "manual"] ?? SOURCE_STYLE.manual;

  const StatusIcon =
    incident.status === "resolved" ? CheckCircle2 :
    incident.status === "in_progress" ? Clock :
    AlertTriangle;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-brand)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
    >
      <StatusIcon className="h-4 w-4 flex-shrink-0" style={{ color: sev.text }} />

      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block" style={{ color: "var(--color-text)" }}>
          {incident.title}
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          {incident.assignee && (
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {incident.assignee}
            </span>
          )}
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {fmtDate(incident.created_at)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <StepProgress total={incident.step_count} done={incident.steps_completed} />
        <Badge style={{ bg: source.bg, text: source.text }} label={source.label} />
        <Badge style={sev} label={incident.severity} />
        <Badge style={sts} label={incident.status.replace("_", " ")} />
        <ChevronRight className="h-3.5 w-3.5 ml-1" style={{ color: "var(--color-text-muted)" }} />
      </div>
    </button>
  );
}

// ── Hub ───────────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "open" | "in_progress" | "resolved";
type SourceFilter = "all" | "manual" | "alert" | "policy_violation";

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "all",         label: "All" },
  { id: "open",        label: "Open" },
  { id: "in_progress", label: "In Progress" },
  { id: "resolved",    label: "Resolved" },
];

export function IncidentHub() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: incidents, isLoading } = useIncidents({
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const visible = (incidents ?? []).filter((inc) => {
    if (sourceFilter !== "all" && (inc.source_type ?? "manual") !== sourceFilter) return false;
    if (search && !inc.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    open:        incidents?.filter((i) => i.status === "open").length ?? 0,
    in_progress: incidents?.filter((i) => i.status === "in_progress").length ?? 0,
    resolved:    incidents?.filter((i) => i.status === "resolved").length ?? 0,
    critical:    incidents?.filter((i) => i.severity === "critical" && i.status !== "resolved").length ?? 0,
  };

  return (
    <div className="page-content flex h-full flex-col overflow-x-hidden">
      {/* Toolbar */}
      <div className="mb-5 flex items-center gap-3 pt-3">
        <div
          className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search incidents…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--color-text)" }}
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-medium flex-shrink-0"
          style={{ background: "var(--color-brand)", color: "#fff" }}
        >
          <Plus className="h-3.5 w-3.5" />
          New incident
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Open",        value: stats.open,        color: "#b91c1c" },
          { label: "In Progress", value: stats.in_progress, color: "#a16207" },
          { label: "Resolved",    value: stats.resolved,    color: "#166534" },
          { label: "Critical",    value: stats.critical,    color: "#b91c1c" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl p-4 flex flex-col gap-1"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</span>
            <span className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-3 border-b" style={{ borderColor: "var(--color-border)" }}>
        {STATUS_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setStatusFilter(id)}
            className="px-3 py-2 text-sm font-medium"
            style={{
              color: statusFilter === id ? "var(--color-brand)" : "var(--color-text-muted)",
              borderBottom: statusFilter === id ? "2px solid var(--color-brand)" : "2px solid transparent",
              background: "transparent",
              marginBottom: "-1px",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Source chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {([
          { id: "all",              label: "All sources" },
          { id: "manual",           label: "Reported" },
          { id: "alert",            label: "Detected" },
          { id: "policy_violation", label: "Policy" },
        ] as { id: SourceFilter; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setSourceFilter(id)}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{
              background: sourceFilter === id ? "var(--color-brand)" : "var(--color-surface)",
              color: sourceFilter === id ? "#fff" : "var(--color-text-muted)",
              border: sourceFilter === id ? "none" : "1px solid var(--color-border)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--color-surface)" }} />
            ))}
          </div>
        )}
        {!isLoading && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            {search ? (
              <>
                <Search className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  No incidents match &ldquo;{search}&rdquo;
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No incidents found.</p>
              </>
            )}
          </div>
        )}
        {visible.map((inc) => (
          <IncidentRow key={inc.id} incident={inc} onClick={() => setSelectedId(inc.id)} />
        ))}
      </div>

      {/* Modals / slide-over */}
      {showCreate && <CreateIncidentModal onClose={() => setShowCreate(false)} />}
      {selectedId != null && (
        <IncidentSlideOver incidentId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
