"use client";

import { useQuery } from "@tanstack/react-query";
import { useInstallation } from "@/contexts/installation-context";
import { ShieldCheck, ArrowLeft, CheckCircle, XCircle, AlertTriangle, HelpCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const statusIcon = (s: string) => ({
  SUCCESS: <CheckCircle   className="h-5 w-5 text-green-500" />,
  FAILED:  <XCircle       className="h-5 w-5 text-red-500"   />,
  WARNING: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
}[s] ?? <HelpCircle className="h-5 w-5 text-gray-400" />);

const statusBadge = (s: string) => cn(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold",
  s === "SUCCESS" && "bg-green-100 text-green-700",
  s === "FAILED"  && "bg-red-100 text-red-700",
  s === "WARNING" && "bg-yellow-100 text-yellow-700",
  !["SUCCESS","FAILED","WARNING"].includes(s) && "bg-gray-100 text-gray-500",
);

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium mb-0.5" style={{ color: "var(--color-text-muted)" }}>{label}</dt>
      <dd className="text-sm" style={{ color: "var(--color-text)" }}>{value ?? "—"}</dd>
    </div>
  );
}

export function QualityCheckDetail({ resultId }: { resultId: string }) {
  const { installation } = useInstallation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["quality-detail", resultId, installation?.installation_id],
    queryFn: async () => {
      const res = await fetch(`/api/quality/${encodeURIComponent(resultId)}`);
      if (!res.ok) throw new Error("Not found");
      return res.json() as Promise<{ data: Record<string, unknown> }>;
    },
    enabled: !!resultId,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="page-content flex h-full items-center justify-center" style={{ color: "var(--color-text-muted)" }}>
        Loading…
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="page-content flex h-full flex-col items-center justify-center gap-3">
        <p style={{ color: "var(--color-error, #dc2626)" }}>Check result not found.</p>
        <Link href="/quality" className="text-sm hover:underline" style={{ color: "var(--color-brand)" }}>
          ← Back to Data Quality
        </Link>
      </div>
    );
  }

  const c = data.data;
  const status = String(c.check_status ?? "UNKNOWN");

  return (
    <div className="page-content flex flex-col gap-6 overflow-x-hidden">
      {/* Breadcrumb */}
      <Link href="/quality" className="flex items-center gap-1.5 text-sm w-fit hover:underline" style={{ color: "var(--color-text-muted)" }}>
        <ArrowLeft className="h-3.5 w-3.5" /> Data Quality
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg" style={{ background: "var(--color-surface-subtle)" }}>
          <ShieldCheck className="h-6 w-6" style={{ color: "var(--color-brand)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-medium leading-tight truncate" style={{ color: "var(--color-text)" }}>
              {String(c.check_name ?? c.check_id)}
            </h1>
            <span className={statusBadge(status)}>
              {statusIcon(status)} {status}
            </span>
          </div>
          <p className="font-mono text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            {String(c.check_id)}
          </p>
        </div>
      </div>

      {/* Main info card */}
      <div className="rounded-xl p-5" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>Check details</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Dataset" value={String(c.dataset_id ?? "—")} />
          <Field label="Layer" value={c.layer ? String(c.layer) : undefined} />
          <Field label="Category" value={c.check_category ? String(c.check_category) : undefined} />
          <Field label="Severity" value={c.severity ? String(c.severity) : undefined} />
          <Field label="Environment" value={c.environment ? String(c.environment) : undefined} />
          <Field label="Policy version" value={c.policy_version ? String(c.policy_version) : undefined} />
          <Field label="Executed at" value={c.timestamp_utc ? new Date(String(c.timestamp_utc)).toLocaleString() : undefined} />
          {!!c.job_name && <Field label="Job" value={String(c.job_name)} />}
          {!!c.run_id && (
            <div>
              <dt className="text-xs font-medium mb-0.5" style={{ color: "var(--color-text-muted)" }}>Run ID</dt>
              <dd className="text-sm font-mono" style={{ color: "var(--color-text)" }}>
                {c.internal_run_id ? (
                  <Link href={`/runs/${encodeURIComponent(String(c.internal_run_id))}`} className="hover:underline" style={{ color: "var(--color-brand)" }}>
                    {String(c.run_id)}
                  </Link>
                ) : String(c.run_id)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Result values */}
      {(c.result_value != null || c.threshold_value != null || !!c.message || !!c.check_result) && (
        <div className="rounded-xl p-5" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>Result</h2>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {c.result_value != null && (
              <Field label="Actual value" value={String(c.result_value)} />
            )}
            {c.threshold_value != null && (
              <Field label="Threshold" value={String(c.threshold_value)} />
            )}
            {!!c.check_result && (
              <Field label="Result detail" value={String(c.check_result)} />
            )}
            {!!c.message && (
              <div className="col-span-full">
                <dt className="text-xs font-medium mb-0.5" style={{ color: "var(--color-text-muted)" }}>Message</dt>
                <dd className="text-sm font-mono p-2 rounded-lg" style={{ color: "var(--color-text)", background: "var(--color-surface-subtle)" }}>
                  {String(c.message)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Check facets */}
      {!!c.check_facets && typeof c.check_facets === "object" && Object.keys(c.check_facets as object).length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>Check facets</h2>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(c.check_facets as Record<string, unknown>).map(([key, val]) => {
              const isComplex = val !== null && typeof val === "object";
              return isComplex ? (
                <div key={key} className="col-span-full">
                  <dt className="text-xs font-medium mb-0.5" style={{ color: "var(--color-text-muted)" }}>{key}</dt>
                  <dd>
                    <pre
                      className="text-xs p-3 rounded-lg overflow-x-auto"
                      style={{ background: "var(--color-surface-subtle)", color: "var(--color-text)" }}
                    >
                      {JSON.stringify(val, null, 2)}
                    </pre>
                  </dd>
                </div>
              ) : (
                <Field key={key} label={key} value={val != null ? String(val) : undefined} />
              );
            })}
          </dl>
        </div>
      )}

    </div>
  );
}
