"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { usePipelines, useQuality, useLineageEntities } from "@/hooks";
import { normalizeStatus } from "@/lib/chart-colors";
import { latestPipelineStepRuns } from "@/lib/pipeline-runs";
import { CheckCircle, AlertTriangle, XCircle, GitBranch, Clock, ChevronDown } from "lucide-react";
import type { WidgetProps } from "../registry";

type HealthStatus = "healthy" | "warning" | "error" | "unknown";

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
  lineageNodes: number;
}

const HEALTH_STYLES: Record<HealthStatus, { border: string; dot: string; label: string }> = {
  healthy: { border: "#10B981", dot: "#10B981", label: "Healthy" },
  warning: { border: "#F59E0B", dot: "#F59E0B", label: "Warning" },
  error:   { border: "#EF4444", dot: "#EF4444", label: "Error" },
  unknown: { border: "var(--color-border)", dot: "var(--color-text-muted)", label: "No data" },
};

function statusColor(status: string): string {
  const s = normalizeStatus(status);
  if (s === "SUCCESS") return "#10B981";
  if (s === "WARNING") return "#F59E0B";
  if (s === "FAILED") return "#EF4444";
  return "var(--color-text)";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function DatasetOverviewWidget({ from, to, titleOverride }: WidgetProps) {
  const { data: pipelineRes, isLoading: loadingP } = usePipelines(from, to);
  const { data: qualityRes,  isLoading: loadingQ } = useQuality(from, to);
  const { data: lineageRes,  isLoading: loadingL } = useLineageEntities();

  const isLoading = loadingP || loadingQ || loadingL;

  const [envFilter, setEnvFilter] = useState<string>("__all__");
  const [selectedDataset, setSelectedDataset] = useState<string>("__all__");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const environments = useMemo(
    () => [...new Set((pipelineRes?.data ?? []).map((r) => r.environment).filter(Boolean) as string[])].sort(),
    [pipelineRes]
  );

  const allRawRuns = pipelineRes?.data ?? [];
  const scopedRuns = envFilter === "__all__" ? allRawRuns : allRawRuns.filter((r) => r.environment === envFilter);
  const runs   = latestPipelineStepRuns(scopedRuns);
  const checks = qualityRes?.data  ?? [];
  const entities = lineageRes?.data ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allDatasets = useMemo((): DatasetSummary[] => {
    const ids = new Set([
      ...runs.map((r) => r.dataset_id),
      ...checks.map((c) => c.dataset_id),
      ...entities.map((entity) => entity.dataset_id).filter((value): value is string => Boolean(value)),
    ]);

    return Array.from(ids).sort().map((id) => {
      const datasetRuns = runs
        .filter((r) => r.dataset_id === id)
        .sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc));
      const latestRun = datasetRuns[0] ?? null;

      const datasetChecks = checks.filter((c) => c.dataset_id === id);
      const dqPass = datasetChecks.filter((c) => normalizeStatus(c.check_status) === "SUCCESS").length;
      const dqWarn = datasetChecks.filter((c) => normalizeStatus(c.check_status) === "WARNING").length;
      const dqFail = datasetChecks.filter((c) => normalizeStatus(c.check_status) === "FAILED").length;
      const passRate = datasetChecks.length > 0 ? Math.round((dqPass / datasetChecks.length) * 100) : -1;

      const datasetEntities = entities.filter((entity) => entity.dataset_id === id);
      const lineageNodes = new Set([
        ...datasetEntities.map((entity) => `${entity.layer.toLowerCase()}::${entity.entity_fqn}`),
      ]);

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
        lineageNodes: lineageNodes.size,
      };
    });
  }, [runs, checks, entities]);

  const datasets = useMemo(() => {
    if (selectedDataset === "__all__") return allDatasets;
    return allDatasets.filter((d) => d.id === selectedDataset);
  }, [allDatasets, selectedDataset]);

  const datasetIds = allDatasets.map((d) => d.id);

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Widget header row */}
      <div className="flex items-center justify-between gap-2 mb-3 shrink-0 flex-wrap">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {titleOverride ?? "Dataset Health"}
        </p>

        <div className="flex items-center gap-2">
          {/* Environment filter */}
          {!isLoading && environments.length > 0 && (
            <select
              value={envFilter}
              onChange={(e) => { setEnvFilter(e.target.value); setSelectedDataset("__all__"); }}
              className="text-xs rounded-md px-2 py-1 outline-none"
              style={{ background: "var(--color-card)", border: `1px solid ${envFilter !== "__all__" ? "var(--color-accent)" : "var(--color-border)"}`, color: envFilter !== "__all__" ? "var(--color-accent)" : "var(--color-text-muted)", fontWeight: envFilter !== "__all__" ? 600 : 400 }}
            >
              <option value="__all__">All envs</option>
              {environments.map((env) => <option key={env} value={env}>{env}</option>)}
            </select>
          )}

          {/* Dataset filter dropdown */}
          {!isLoading && datasetIds.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
              style={{
                border: "1px solid var(--color-border)",
                background: selectedDataset !== "__all__" ? "rgba(200,137,42,0.08)" : "var(--color-card)",
                color: selectedDataset !== "__all__" ? "var(--color-accent)" : "var(--color-text-muted)",
              }}
            >
              <span className="max-w-[100px] truncate">
                {selectedDataset === "__all__" ? "All datasets" : selectedDataset}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-lg overflow-y-auto"
                style={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  boxShadow: "var(--shadow-md, 0 4px 12px rgba(0,0,0,0.15))",
                  minWidth: 160,
                  maxHeight: 200,
                }}
              >
                {[{ id: "__all__", label: "All datasets" }, ...datasetIds.map((id) => ({ id, label: id }))].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setSelectedDataset(opt.id); setDropdownOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs truncate transition-colors"
                    style={{
                      color: selectedDataset === opt.id ? "var(--color-accent)" : "var(--color-text)",
                      fontWeight: selectedDataset === opt.id ? 600 : 400,
                      background: "transparent",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--color-sidebar-hover)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5" style={{ minHeight: 0 }}>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))
        ) : datasets.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: "var(--color-text-muted)" }}>
            No dataset data in selected range
          </p>
        ) : (
          datasets.map((ds) => <DatasetRow key={ds.id} dataset={ds} />)
        )}
      </div>
    </div>
  );
}

function DatasetRow({ dataset: ds }: { dataset: DatasetSummary }) {
  const h = HEALTH_STYLES[ds.health];

  return (
    <div
      className="rounded-lg px-3 py-2.5 space-y-2"
      style={{
        background: "var(--color-surface)",
        border: `1.5px solid ${h.border}`,
      }}
    >
      {/* Top row: name + health */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: "var(--color-text)" }}>{ds.id}</p>
          {ds.lastStep && (
            <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
              {ds.lastStep}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: h.dot }} />
          <span className="text-xs" style={{ color: h.dot }}>{h.label}</span>
        </div>
      </div>

      {/* Bottom row: DQ pills + lineage + last run time */}
      <div className="flex items-center gap-3 flex-wrap">
        {ds.dqTotal > 0 ? (
          <>
            {ds.dqPass > 0 && (
              <span className="flex items-center gap-0.5 text-xs font-medium" style={{ color: "#10B981" }}>
                <CheckCircle className="h-3 w-3" />{ds.dqPass}
              </span>
            )}
            {ds.dqWarn > 0 && (
              <span className="flex items-center gap-0.5 text-xs font-medium" style={{ color: "#F59E0B" }}>
                <AlertTriangle className="h-3 w-3" />{ds.dqWarn}
              </span>
            )}
            {ds.dqFail > 0 && (
              <span className="flex items-center gap-0.5 text-xs font-medium" style={{ color: "#EF4444" }}>
                <XCircle className="h-3 w-3" />{ds.dqFail}
              </span>
            )}
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {ds.passRate >= 0 ? `${ds.passRate}% pass` : ""}
            </span>
          </>
        ) : (
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>no DQ checks</span>
        )}

        <div className="flex-1" />

        {ds.lineageNodes > 0 && (
          <span className="flex items-center gap-0.5 text-xs" style={{ color: "var(--color-text-muted)" }} title="Lineage Nodes">
            <GitBranch className="h-3 w-3" />{ds.lineageNodes}
          </span>
        )}
        {ds.lastRunAt && (
          <span
            className="flex items-center gap-0.5 text-xs"
            style={{ color: ds.lastRunStatus ? statusColor(ds.lastRunStatus) : "var(--color-text-muted)" }}
          >
            <Clock className="h-3 w-3" />{timeAgo(ds.lastRunAt)}
          </span>
        )}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div
      className="rounded-lg px-3 py-2.5 space-y-2 animate-pulse"
      style={{ background: "var(--color-surface)", border: "1.5px solid var(--color-border)" }}
    >
      <div className="flex justify-between">
        <div className="h-3 w-28 rounded" style={{ background: "var(--color-border)" }} />
        <div className="h-3 w-14 rounded" style={{ background: "var(--color-border)" }} />
      </div>
      <div className="h-3 w-40 rounded" style={{ background: "var(--color-border)" }} />
    </div>
  );
}
