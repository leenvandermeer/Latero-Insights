"use client";

import { useRunDetail } from "@/hooks/use-runs";
import { ApiClientError } from "@/lib/api";
import {
  Activity,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Database,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { RunDetail as RunDetailType } from "@/types/v2";

function formatDuration(raw: unknown): string {
  if (raw == null) return "—";
  const ms = Number(raw);
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}u ${mins}m` : `${hours}u`;
}

const statusIcon = (s: string) => ({
  SUCCESS: <CheckCircle className="h-4 w-4 text-green-500" />,
  FAILED:  <XCircle    className="h-4 w-4 text-red-500"   />,
  WARNING: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  RUNNING: <Clock      className="h-4 w-4 text-blue-500"  />,
}[s] ?? <span className="h-4 w-4 rounded-full bg-gray-300 inline-block" />);

const statusBadge = (s: string) => cn(
  "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold",
  s === "SUCCESS" && "bg-green-100 text-green-700",
  s === "FAILED"  && "bg-red-100 text-red-700",
  s === "WARNING" && "bg-yellow-100 text-yellow-700",
  s === "RUNNING" && "bg-blue-100 text-blue-700",
  !["SUCCESS","FAILED","WARNING","RUNNING"].includes(s) && "bg-gray-100 text-gray-500",
);

export function RunDetail({ runId }: { runId: string }) {
  const { data, error, isLoading, isError } = useRunDetail(runId);
  const run = data?.data as RunDetailType | undefined;
  const apiError = error instanceof ApiClientError ? error : null;

  if (isLoading) {
    return (
      <div className="page-content flex h-full items-center justify-center" style={{ color: "var(--color-text-muted)" }}>
        Loading…
      </div>
    );
  }

  if (isError || !run) {
    const message = apiError?.status === 404
      ? "Run not found."
      : apiError?.status === 401
        ? "You are not authorized to view this run."
        : "Failed to load run details.";

    return (
      <div className="page-content flex h-full flex-col items-center justify-center gap-3">
        <p className="text-red-500">{message}</p>
        <Link href="/runs" className="text-sm hover:underline" style={{ color: "var(--color-brand)" }}>
          ← Back to Runs
        </Link>
      </div>
    );
  }

  const status        = String(run.status ?? "UNKNOWN");
  const attemptNumber = run.attempt_number != null ? Number(run.attempt_number) : null;
  const isRetry       = attemptNumber != null && attemptNumber > 0;
  const trigger       = run.trigger ? String(run.trigger) : null;
  const runPageUrl    = run.run_page_url ? String(run.run_page_url) : null;
  const durationMs    = run.duration_ms    != null ? Number(run.duration_ms)    : null;
  const queueMs       = run.queue_duration_ms != null ? Number(run.queue_duration_ms) : null;
  const setupMs       = run.setup_duration_ms != null ? Number(run.setup_duration_ms) : null;
  const execMs        = durationMs != null && queueMs != null && setupMs != null
    ? Math.max(0, durationMs - queueMs - setupMs) : durationMs;
  const hasBreakdown  = queueMs != null && setupMs != null && durationMs != null && durationMs > 0;
  const io       = run.io_datasets ?? [];
  const dqChecks = run.dq_checks ?? [];
  const children = run.child_runs ?? [];
  const taskLabel = run.task_key || run.job_name || runId;

  return (
    <div className="page-content flex flex-col gap-6 overflow-x-hidden">
      {/* Breadcrumb */}
      <Link href="/runs" className="flex items-center gap-1.5 text-sm w-fit hover:underline" style={{ color: "var(--color-text-muted)" }}>
        <ArrowLeft className="h-3.5 w-3.5" /> Runs
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg" style={{ background: "var(--color-surface-subtle)" }}>
          <Activity className="h-6 w-6" style={{ color: "var(--color-brand)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-medium leading-tight truncate" style={{ color: "var(--color-text)" }}>
              {taskLabel}
            </h1>
            <span className={statusBadge(status)}>
              {statusIcon(status)} {status}
            </span>
            {isRetry && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-orange-100 text-orange-700">
                <RefreshCw className="h-3 w-3" /> Retry #{attemptNumber}
              </span>
            )}
            {trigger && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-[var(--color-surface-subtle)]" style={{ color: "var(--color-text-muted)" }}>
                {trigger}
              </span>
            )}
            {runPageUrl && (
              <a href={runPageUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs hover:underline"
                style={{ color: "var(--color-brand)" }}>
                <ExternalLink className="h-3 w-3" /> Databricks
              </a>
            )}
          </div>
          <p className="text-sm mt-1 font-mono" style={{ color: "var(--color-text-muted)" }}>{runId}</p>
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Job",         value: String(run.job_name ?? run.dataset_id ?? "—") },
          { label: "Task",        value: String(run.task_key ?? "—") },
          { label: "Started",     value: run.started_at ? new Date(String(run.started_at)).toLocaleString() : "—" },
          { label: "Finished",    value: run.ended_at ? new Date(String(run.ended_at)).toLocaleString() : "—" },
          { label: "Duration",    value: formatDuration(run.duration_ms) },
          { label: "Environment", value: String(run.environment ?? "—") },
          { label: "Run ID",      value: String(run.external_run_id ?? "—") },
          { label: "Retry",       value: attemptNumber != null ? String(attemptNumber) : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border px-4 py-3" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>{label}</p>
            <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>{value}</p>
          </div>
        ))}
      </div>

      <Section icon={<Activity className="h-4 w-4" />} title="Execution context">
        <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-2">
          <DetailBlock label="Latero run UUID" value={run.run_id} mono />
          <DetailBlock label="External run ID" value={run.external_run_id ?? "—"} mono />
          <DetailBlock label="Task key" value={run.task_key ?? "—"} mono />
          <DetailBlock label="Databricks job run ID" value={run.dbx_job_run_id ?? "—"} mono />
          <DetailBlock label="Databricks task run ID" value={run.dbx_task_run_id ?? "—"} mono />
          <DetailBlock label="Parent run ID" value={run.parent_run_id ?? "—"} mono />
          <DetailBlock label="Trigger" value={trigger ?? "—"} />
        </div>
      </Section>

      {/* Timing breakdown */}
      {hasBreakdown && (
        <Section icon={<Timer className="h-4 w-4" />} title="Timing breakdown">
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="flex gap-0 h-4 rounded overflow-hidden w-full">
              {queueMs! > 0 && (
                <div
                  title={`Queue: ${formatDuration(queueMs)}`}
                  className="h-full"
                  style={{ width: `${(queueMs! / durationMs!) * 100}%`, background: "var(--color-surface-alt, #e2e8f0)" }}
                />
              )}
              {setupMs! > 0 && (
                <div
                  title={`Setup: ${formatDuration(setupMs)}`}
                  className="h-full"
                  style={{ width: `${(setupMs! / durationMs!) * 100}%`, background: "var(--color-warning, #f59e0b)" }}
                />
              )}
              <div
                title={`Execution: ${formatDuration(execMs)}`}
                className="h-full flex-1"
                style={{ background: "var(--color-brand)" }}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <LegendItem color="var(--color-surface-alt, #e2e8f0)" label="Queue" value={formatDuration(queueMs)} textColor="var(--color-text-muted)" />
              <LegendItem color="var(--color-warning, #f59e0b)" label="Setup" value={formatDuration(setupMs)} textColor="var(--color-text-muted)" />
              <LegendItem color="var(--color-brand)" label="Execution" value={formatDuration(execMs)} textColor="var(--color-text)" />
            </div>
          </div>
        </Section>
      )}

      {/* I/O datasets */}
      {io.length > 0 && (
        <Section icon={<Database className="h-4 w-4" />} title={`Involved datasets (${io.length})`}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["Dataset", "Layer", "Role"].map((h) => (
                <th key={h} className="text-left px-4 py-2 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
              {io.map((d, i) => (
                <tr key={i} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--color-text)" }}>{String(d.entity_fqn ?? d.dataset_id ?? "—")}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--color-text-muted)" }}>{String(d.layer ?? "—")}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                      d.role === "INPUT"  ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    )}>
                      {String(d.role ?? "—")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* DQ checks */}
      {dqChecks.length > 0 && (
        <Section icon={<ShieldCheck className="h-4 w-4" />} title={`DQ checks (${dqChecks.length})`}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["Check", "Status", "Category", "Priority"].map((h) => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dqChecks.map((c, i) => (
                <tr key={i} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--color-text)" }}>{String(c.check_name ?? c.check_id ?? "—")}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn("inline-flex items-center gap-1 text-xs font-medium",
                      c.status === "SUCCESS" ? "text-green-600" : "text-red-600"
                    )}>
                      {c.status === "SUCCESS" ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {String(c.status ?? "—")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {c.check_result
                      ? JSON.stringify(c.check_result).slice(0, 80)
                      : c.check_category
                        ? <span className="px-1.5 py-0.5 rounded bg-[var(--color-surface-subtle)] text-[10px] font-medium uppercase tracking-wide">{String(c.check_category)}</span>
                        : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {c.severity
                      ? <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                          String(c.severity).toUpperCase() === "CRITICAL" ? "bg-red-100 text-red-700" :
                          String(c.severity).toUpperCase() === "HIGH"     ? "bg-orange-100 text-orange-700" :
                          String(c.severity).toUpperCase() === "MEDIUM"   ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-500"
                        )}>{String(c.severity)}</span>
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Child runs */}
      {children.length > 0 && (
        <Section icon={<Activity className="h-4 w-4" />} title={`Child runs (${children.length})`}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["Status", "Task", "Started"].map((h) => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {children.map((c, i) => (
                <tr key={i} className="border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                  <td className="px-4 py-2.5">
                    <span className={statusBadge(String(c.status ?? ""))}>
                      {statusIcon(String(c.status ?? ""))} {String(c.status ?? "—")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <div className="flex flex-col">
                      <span className="font-mono" style={{ color: "var(--color-text)" }}>
                        {String(c.task_key ?? "—")}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {c.started_at ? new Date(String(c.started_at)).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}

function LegendItem({ color, label, value, textColor }: { color: string; label: string; value: string; textColor: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span className="font-medium" style={{ color: textColor }}>{value}</span>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
        <span style={{ color: "var(--color-text-muted)" }}>{icon}</span>
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function DetailBlock({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>{label}</p>
      <p className={cn("text-sm", mono ? "font-mono break-all" : "break-words")} style={{ color: "var(--color-text)" }}>
        {value}
      </p>
    </div>
  );
}
