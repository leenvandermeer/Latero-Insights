"use client";

import { useMemo, useState } from "react";
import { usePipelines, useQuality, useLineage, useDateRange } from "@/hooks";
import {
  PageHeader,
  DateRangePicker,
  SourceIndicator,
  ErrorMessage,
  EmptyState,
} from "@/components/ui";
import { isNoDataError } from "@/lib/api";
import { normalizeStatus } from "@/lib/chart-colors";
import { latestPipelineStepRuns } from "@/lib/pipeline-runs";
import { useLineageEntities } from "@/hooks/use-lineage-entities";
import { CheckCircle, AlertTriangle, XCircle, GitBranch, Clock, X, Database } from "lucide-react";
import type { HealthStatus } from "../lineage/lineage-utils";
import type { DataQualityCheck, LineageHop, PipelineRun } from "@/lib/adapters/types";
import { isContextHop, isDataFlowHop } from "@/lib/lineage-hop-kind";

interface DatasetSummary {
  id: string;
  lastRunStatus: string | null;
  lastRunAt: string | null;
  lastStep: string | null;
  dqTotal: number;
  dqPass: number;
  dqWarn: number;
  dqFail: number;
  passRate: number;
  health: HealthStatus;
  lineageDepth: number;
}

const HEALTH_STYLES: Record<HealthStatus, { border: string; dot: string; label: string }> = {
  healthy: { border: "#10B981", dot: "#10B981", label: "Healthy" },
  warning: { border: "#F59E0B", dot: "#F59E0B", label: "Warning" },
  error:   { border: "#EF4444", dot: "#EF4444", label: "Error" },
  unknown: { border: "var(--color-border)", dot: "var(--color-text-muted)", label: "No data" },
};

export function DatasetsDashboard() {
  const { from, to, setRange } = useDateRange();
  const { data: pipelineRes, isLoading: loadingP, error: errorP } = usePipelines(from, to);
  const { data: qualityRes, isLoading: loadingQ, error: errorQ } = useQuality(from, to);
  const { data: lineageRes, isLoading: loadingL, error: errorL } = useLineage(from, to);
  const { data: lineageEntitiesRes, isLoading: loadingE, error: errorE } = useLineageEntities();
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);

  const isLoading = loadingP || loadingQ || loadingL || loadingE;
  const error = errorP || errorQ || errorL || errorE;
  const source = pipelineRes?.source ?? qualityRes?.source ?? lineageRes?.source ?? lineageEntitiesRes?.source;
  const cachedAt = pipelineRes?.cachedAt ?? qualityRes?.cachedAt ?? lineageRes?.cachedAt ?? lineageEntitiesRes?.cachedAt;

  const runs = latestPipelineStepRuns(pipelineRes?.data ?? []);
  const checks = qualityRes?.data ?? [];
  const hops = lineageRes?.data ?? [];
  const dataFlowHops = useMemo(() => hops.filter(isDataFlowHop), [hops]);
  const lineageEntities = lineageEntitiesRes?.data ?? [];

  const datasets = useMemo((): DatasetSummary[] => {
      const ids = new Set([
        ...runs.map((r) => r.dataset_id),
        ...checks.map((c) => c.dataset_id),
        ...dataFlowHops.map((h) => h.dataset_id),
      ]);

    return Array.from(ids).sort().map((id) => {
      // Latest run for this dataset
      const datasetRuns = runs
        .filter((r) => r.dataset_id === id)
        .sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc));
      const latestRun = datasetRuns[0] ?? null;

      // DQ checks
      const datasetChecks = checks.filter((c) => c.dataset_id === id);
      const dqPass = datasetChecks.filter((c) => ["SUCCESS", "PASS"].includes(normalizeStatus(c.check_status))).length;
      const dqWarn = datasetChecks.filter((c) => ["WARNING", "WARN"].includes(normalizeStatus(c.check_status))).length;
      const dqFail = datasetChecks.filter((c) => normalizeStatus(c.check_status) === "FAILED").length;
      const passRate = datasetChecks.length > 0 ? Math.round((dqPass / datasetChecks.length) * 100) : -1;

      // Lineage depth = unique entities connected to this dataset
      const datasetEntities = lineageEntities.filter((entity) => entity.dataset_id === id);
      const entities = new Set([
        ...datasetEntities.map((entity) => `${entity.layer.toLowerCase()}::${entity.name}`),
      ]);

      // Health
      let health: HealthStatus = "unknown";
      if (dqFail > 0) health = "error";
      else if (dqWarn > 0) health = "warning";
      else if (dqPass > 0) health = "healthy";
      else if (latestRun) {
        const s = normalizeStatus(latestRun.run_status);
        if (s === "SUCCESS") health = "healthy";
        else if (s === "WARNING") health = "warning";
        else if (s === "FAILED") health = "error";
      }

      return {
        id,
        lastRunStatus: latestRun?.run_status ?? null,
        lastRunAt: latestRun?.timestamp_utc ?? null,
        lastStep: latestRun?.step ?? null,
        dqTotal: datasetChecks.length,
        dqPass,
        dqWarn,
        dqFail,
        passRate,
        health,
        lineageDepth: entities.size,
      };
    });
  }, [runs, checks, dataFlowHops, lineageEntities]);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Datasets" icon={Database} actions={<DateRangePicker from={from} to={to} onChange={setRange} />} />
        {isNoDataError(error)
          ? <EmptyState from={from} to={to} />
          : <ErrorMessage message={error.message} />
        }
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Datasets"
        icon={Database}
        actions={
          <div className="flex items-center gap-1.5">
            {source && <SourceIndicator source={source} cachedAt={cachedAt} />}
            <DateRangePicker from={from} to={to} onChange={setRange} />
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <DatasetCardSkeleton key={i} />
          ))}
        </div>
      ) : datasets.length === 0 ? (
        <EmptyState from={from} to={to} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {datasets.map((ds) => (
            <DatasetCard key={ds.id} dataset={ds} onOpen={() => setSelectedDatasetId(ds.id)} />
          ))}
        </div>
      )}

      {selectedDatasetId && (
        <DatasetEvidenceDrawer
          datasetId={selectedDatasetId}
          runs={runs.filter((run) => run.dataset_id === selectedDatasetId)}
          checks={checks.filter((check) => check.dataset_id === selectedDatasetId)}
          hops={hops.filter((hop) => hop.dataset_id === selectedDatasetId)}
          onClose={() => setSelectedDatasetId(null)}
        />
      )}
    </div>
  );
}

function DatasetCard({ dataset: ds, onOpen }: { dataset: DatasetSummary; onOpen: () => void }) {
  const h = HEALTH_STYLES[ds.health];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-xl p-4 space-y-4 text-left transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2"
      style={{
        background: "var(--color-surface)",
        border: `1.5px solid ${h.border}`,
        boxShadow: "var(--shadow-sm)",
        color: "inherit",
      }}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "var(--color-text)" }}>{ds.id}</p>
          {ds.lastStep && (
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--color-text-muted)" }}>
              Last: {ds.lastStep}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full" style={{ background: h.dot }} />
          <span className="text-xs font-medium" style={{ color: h.dot }}>{h.label}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {/* DQ */}
        <StatCell
          label="DQ Pass"
          value={ds.passRate >= 0 ? `${ds.passRate}%` : "—"}
          sub={ds.dqTotal > 0 ? `${ds.dqPass}/${ds.dqTotal} checks` : "no checks"}
        />
        {/* Last run */}
        <StatCell
          label="Last run"
          value={ds.lastRunStatus ?? "—"}
          sub={ds.lastRunAt ? timeAgo(ds.lastRunAt) : "never"}
          statusColor={ds.lastRunStatus ? statusColor(ds.lastRunStatus) : undefined}
        />
        {/* Lineage */}
        <StatCell
          label="Lineage"
          value={ds.lineageDepth > 0 ? `${ds.lineageDepth}` : "—"}
          sub={ds.lineageDepth > 0 ? "entities" : "no lineage"}
        />
      </div>

      {/* DQ breakdown */}
      {ds.dqTotal > 0 && (
        <div className="flex items-center gap-3 pt-1" style={{ borderTop: "1px solid var(--color-border)" }}>
          <DQPill icon={<CheckCircle className="h-3 w-3" />} color="#10B981" value={ds.dqPass} label="pass" />
          <DQPill icon={<AlertTriangle className="h-3 w-3" />} color="#F59E0B" value={ds.dqWarn} label="warn" />
          <DQPill icon={<XCircle className="h-3 w-3" />} color="#EF4444" value={ds.dqFail} label="fail" />
          <div className="flex-1" />
          <div className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            <GitBranch className="h-3 w-3" />
            {ds.lineageDepth}
          </div>
          {ds.lastRunAt && (
            <div className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <Clock className="h-3 w-3" />
              {timeAgo(ds.lastRunAt)}
            </div>
          )}
        </div>
      )}
    </button>
  );
}

function DatasetEvidenceDrawer({
  datasetId,
  runs,
  checks,
  hops,
  onClose,
}: {
  datasetId: string;
  runs: PipelineRun[];
  checks: DataQualityCheck[];
  hops: LineageHop[];
  onClose: () => void;
}) {
  const sortedRuns = [...runs].sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc)).slice(0, 8);
  const sortedChecks = [...checks].sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc)).slice(0, 10);
  const sortedHops = [...hops].sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc)).slice(0, 10);
  const dataFlowCount = hops.filter(isDataFlowHop).length;
  const contextCount = hops.filter(isContextHop).length;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} />
      <aside
        className="fixed right-0 top-0 bottom-0 z-40 w-full max-w-[520px] overflow-y-auto"
        style={{ background: "var(--color-card)", borderLeft: "1px solid var(--color-border)", boxShadow: "var(--shadow-drawer)" }}
      >
        <div
          className="sticky top-0 flex items-start justify-between gap-3 px-5 py-4"
          style={{ background: "var(--color-card)", borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>Dataset evidence</p>
            <h2 className="truncate text-lg font-semibold" style={{ color: "var(--color-text)" }}>{datasetId}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1" aria-label="Close" style={{ color: "var(--color-text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <EvidenceSection title={`Recent runs (${runs.length})`}>
            {sortedRuns.length === 0 ? (
              <EmptyEvidence>No runs found.</EmptyEvidence>
            ) : sortedRuns.map((run) => (
              <EvidenceRow key={`${run.run_id}:${run.step}`} title={run.step} meta={`${run.run_status} · ${fmtTime(run.timestamp_utc)}`} detail={run.run_id} />
            ))}
          </EvidenceSection>

          <EvidenceSection title={`Quality checks (${checks.length})`}>
            {sortedChecks.length === 0 ? (
              <EmptyEvidence>No checks found.</EmptyEvidence>
            ) : sortedChecks.map((check) => (
              <EvidenceRow
                key={`${check.run_id}:${check.check_id}`}
                title={check.check_id}
                meta={`${normalizeStatus(check.check_status)} · ${check.check_category ?? "uncategorized"}`}
                detail={check.step}
              />
            ))}
          </EvidenceSection>

          <EvidenceSection title={`Lineage hops (${dataFlowCount} data flow${dataFlowCount !== 1 ? "s" : ""}${contextCount > 0 ? `, ${contextCount} context` : ""})`}>
            {sortedHops.length === 0 ? (
              <EmptyEvidence>No lineage hops found.</EmptyEvidence>
            ) : sortedHops.map((hop, index) => (
              <EvidenceRow
                key={`${hop.run_id}:${index}`}
                title={`${hop.source_ref || hop.source_entity} -> ${hop.target_ref || hop.target_entity}`}
                meta={`${hop.step} · ${isDataFlowHop(hop) ? "data_flow" : (hop.hop_kind ?? "context")} · ${fmtTime(hop.timestamp_utc)}`}
                detail={`${hop.source_ref || hop.source_entity}${hop.source_attribute ? `.${hop.source_attribute}` : ""} -> ${hop.target_ref || hop.target_entity}${hop.target_attribute ? `.${hop.target_attribute}` : ""}`}
              />
            ))}
          </EvidenceSection>
        </div>
      </aside>
    </>
  );
}

function EvidenceSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
      <h3 className="px-3 py-2 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>{title}</h3>
      <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>{children}</div>
    </section>
  );
}

function EvidenceRow({ title, meta, detail }: { title: string; meta: string; detail: string }) {
  return (
    <div className="px-3 py-2">
      <p className="truncate text-sm font-medium" style={{ color: "var(--color-text)" }} title={title}>{title}</p>
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{meta}</p>
      <p className="truncate text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }} title={detail}>{detail}</p>
    </div>
  );
}

function EmptyEvidence({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-4 text-sm" style={{ color: "var(--color-text-muted)" }}>{children}</p>;
}

function StatCell({ label, value, sub, statusColor: sc }: { label: string; value: string; sub: string; statusColor?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--color-text-muted)" }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: sc ?? "var(--color-text)" }}>{value}</p>
      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{sub}</p>
    </div>
  );
}

function DQPill({ icon, color, value, label }: { icon: React.ReactNode; color: string; value: number; label: string }) {
  if (value === 0) return <div className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-muted)", opacity: 0.4 }}>{icon}<span>0 {label}</span></div>;
  return (
    <div className="flex items-center gap-1 text-xs font-medium" style={{ color }}>
      {icon}<span>{value} {label}</span>
    </div>
  );
}

function DatasetCardSkeleton() {
  return (
    <div
      className="rounded-xl p-4 space-y-4 animate-pulse"
      style={{ background: "var(--color-surface)", border: "1.5px solid var(--color-border)" }}
    >
      <div className="flex justify-between">
        <div className="h-4 w-32 rounded" style={{ background: "var(--color-border)" }} />
        <div className="h-4 w-16 rounded" style={{ background: "var(--color-border)" }} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0,1,2].map(i => <div key={i} className="h-12 rounded" style={{ background: "var(--color-border)" }} />)}
      </div>
    </div>
  );
}

function statusColor(status: string): string {
  const s = normalizeStatus(status);
  if (s === "SUCCESS") return "#10B981";
  if (s === "WARNING") return "#F59E0B";
  if (s === "FAILED") return "#EF4444";
  return "var(--color-text)";
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
