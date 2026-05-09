"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ChevronLeft, RefreshCw, AlertTriangle, Shield, GitBranch, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useDataProduct } from "@/hooks/use-data-products";
import { useTrustScore } from "@/hooks/use-trust-score";
import { useIncidents } from "@/hooks/use-incidents";
import { TrustScoreBreakdown } from "@/components/trust/trust-score-breakdown";
import { TrustScoreBadge } from "@/components/trust/trust-score-badge";

type Tab = "overview" | "incidents" | "lineage" | "evidence";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",  label: "Overview" },
  { id: "incidents", label: "Incidents" },
  { id: "lineage",   label: "Lineage" },
  { id: "evidence",  label: "Evidence" },
];

const SLA_STYLE: Record<string, { bg: string; text: string }> = {
  bronze: { bg: "#fed7aa", text: "#c2410c" },
  silver: { bg: "#cffafe", text: "#0e7490" },
  gold:   { bg: "#fef9c3", text: "#a16207" },
};

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

interface Incident {
  id: number;
  title: string;
  severity: string;
  status: string;
  opened_at: string;
  resolved_at: string | null;
}

function Badge({ style, label }: { style: { bg: string; text: string }; label: string }) {
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
      style={{ background: style.bg, color: style.text }}
    >
      {label}
    </span>
  );
}

function IncidentRow({ incident }: { incident: Incident }) {
  const sev = SEVERITY_STYLE[incident.severity] ?? SEVERITY_STYLE.low;
  const sts = STATUS_STYLE[incident.status] ?? STATUS_STYLE.open;
  const when = new Date(incident.opened_at).toLocaleDateString();
  return (
    <div
      className="flex items-center gap-3 py-2 px-3 rounded-lg"
      style={{ background: "var(--color-surface-raised)" }}
    >
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: sev.text }} />
      <span className="flex-1 text-sm truncate" style={{ color: "var(--color-text)" }}>
        {incident.title}
      </span>
      <Badge style={sev} label={incident.severity} />
      <Badge style={sts} label={incident.status.replace("_", " ")} />
      <span className="text-xs whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>
        {when}
      </span>
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

interface DataProduct {
  data_product_id: string;
  display_name: string;
  description: string | null;
  owner: string | null;
  domain: string | null;
  sla_tier: "bronze" | "silver" | "gold" | null;
  contract_ver: string | null;
  entity_count: number;
  updated_at: string;
}

interface TrustScoreData {
  score: number;
  factors: {
    has_owner: boolean;
    has_sla: boolean;
    lineage_coverage: number;
    quality_pass_rate: number;
    open_critical_incidents: number;
  };
}

function OverviewTab({
  product,
  trustScore,
}: {
  product: DataProduct;
  trustScore: TrustScoreData | null;
}) {
  const slaStyle = product.sla_tier ? SLA_STYLE[product.sla_tier] : null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Meta card */}
      <div
        className="lg:col-span-2 rounded-xl p-4 flex flex-col gap-3"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Details</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt style={{ color: "var(--color-text-muted)" }}>Owner</dt>
          <dd style={{ color: "var(--color-text)" }}>{product.owner ?? "—"}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Domain</dt>
          <dd style={{ color: "var(--color-text)" }}>{product.domain ?? "—"}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>SLA Tier</dt>
          <dd>
            {slaStyle ? (
              <Badge style={slaStyle} label={product.sla_tier!} />
            ) : (
              <span style={{ color: "var(--color-text-muted)" }}>—</span>
            )}
          </dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Contract version</dt>
          <dd style={{ color: "var(--color-text)" }}>{product.contract_ver ?? "—"}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Entities</dt>
          <dd style={{ color: "var(--color-text)" }}>{product.entity_count}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Last updated</dt>
          <dd style={{ color: "var(--color-text)" }}>
            {new Date(product.updated_at).toLocaleDateString()}
          </dd>
        </dl>
        {product.description && (
          <p className="text-xs leading-relaxed mt-2" style={{ color: "var(--color-text-muted)" }}>
            {product.description}
          </p>
        )}
      </div>

      {/* Trust score */}
      {trustScore ? (
        <TrustScoreBreakdown score={trustScore.score} factors={trustScore.factors} />
      ) : (
        <div
          className="rounded-xl p-4 flex items-center justify-center"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
            <Shield className="h-4 w-4" />
            Trust score unavailable
          </div>
        </div>
      )}
    </div>
  );
}

// ── Incidents tab ─────────────────────────────────────────────────────────────

function IncidentsTab({ productId }: { productId: string }) {
  const { data: incidents, isLoading } = useIncidents({ product_id: productId });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Link
          href={`/incidents?product_id=${encodeURIComponent(productId)}`}
          className="text-xs hover:underline flex items-center gap-1"
          style={{ color: "var(--color-brand)" }}
        >
          View all incidents <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href={`/incidents?new=1&product_id=${encodeURIComponent(productId)}`}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--color-brand)", color: "#fff" }}
        >
          <Plus className="h-3.5 w-3.5" />
          Create incident
        </Link>
      </div>

      {isLoading && (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading incidents…</p>
      )}
      {!isLoading && (!incidents || incidents.length === 0) && (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <AlertTriangle className="h-6 w-6 mx-auto mb-2" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            No incidents recorded for this product.
          </p>
        </div>
      )}
      {incidents?.map((inc) => <IncidentRow key={inc.id} incident={inc as Incident} />)}
    </div>
  );
}

// ── Evidence tab ──────────────────────────────────────────────────────────────

interface EvidenceRecord {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  recorded_at: string;
  recorded_by: string | null;
}

const EVENT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  quality_run:    { bg: "#dcfce7", text: "#166534" },
  lineage_update: { bg: "#dbeafe", text: "#1e40af" },
  policy_check:   { bg: "#fef9c3", text: "#a16207" },
  incident:       { bg: "#fee2e2", text: "#b91c1c" },
};

function summarisePayload(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case "quality_run": {
      const check = payload.check_name ?? payload.check_id ?? "check";
      const result = payload.result ?? payload.status ?? payload.verdict;
      return result ? `${String(check)}: ${String(result)}` : String(check);
    }
    case "lineage_update": {
      const from = payload.source ?? payload.from;
      const to   = payload.target ?? payload.to;
      if (from && to) return `${String(from)} → ${String(to)}`;
      return payload.message ? String(payload.message) : "Lineage updated";
    }
    case "policy_check": {
      const policy  = payload.policy_name ?? payload.policy_id ?? "policy";
      const verdict = payload.verdict ?? payload.result;
      return verdict ? `${String(policy)}: ${String(verdict)}` : String(policy);
    }
    case "incident":
      return payload.title ? String(payload.title) : "Incident recorded";
    default: {
      const entries = Object.entries(payload).slice(0, 3);
      if (entries.length === 0) return "—";
      return entries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
    }
  }
}

function EvidenceTab({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["evidence", productId],
    queryFn: () =>
      fetch(`/api/products/${encodeURIComponent(productId)}/evidence`)
        .then((r) => r.json())
        .then((b: { data: EvidenceRecord[] }) => b.data),
    staleTime: 30_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <div className="h-5 w-20 rounded-full animate-pulse shrink-0" style={{ background: "var(--color-border)" }} />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-4 w-full rounded animate-pulse" style={{ background: "var(--color-border)" }} />
              <div className="h-3 w-32 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <Shield className="h-6 w-6 mx-auto mb-2" style={{ color: "var(--color-text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No evidence records yet.</p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          Records appear automatically as pipeline runs and quality checks complete.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {data.map((rec) => {
        const style   = EVENT_TYPE_COLORS[rec.event_type] ?? { bg: "#f1f5f9", text: "#475569" };
        const summary = summarisePayload(rec.event_type, rec.payload);
        return (
          <div key={rec.id} className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium mt-0.5 shrink-0"
              style={{ background: style.bg, color: style.text }}>
              {rec.event_type.replace(/_/g, " ")}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate" style={{ color: "var(--color-text)" }}>
                {summary}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                {new Date(rec.recorded_at).toLocaleString("en-GB", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
                {rec.recorded_by && ` · ${rec.recorded_by}`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Lineage tab ───────────────────────────────────────────────────────────────

function LineageTab({ productId }: { productId: string }) {
  return (
    <div
      className="rounded-xl p-8 flex flex-col items-center gap-4 text-center"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <GitBranch className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
          View lineage for this product
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          Explore upstream sources and downstream consumers in the full lineage graph.
        </p>
      </div>
      <Link
        href={`/lineage?product_id=${encodeURIComponent(productId)}`}
        className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-90"
        style={{ background: "var(--color-brand)", color: "#fff" }}
      >
        Open lineage graph <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ProductDetail({ productId }: { productId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo<Tab>(() => {
    const v = searchParams.get("tab");
    return (v === "overview" || v === "incidents" || v === "lineage" || v === "evidence")
      ? v : "overview";
  }, [searchParams]);

  const { data: productResponse, isLoading, error } = useDataProduct(productId);
  const { data: trustData } = useTrustScore(productId);
  const [refreshing, setRefreshing] = useState(false);

  const product = (productResponse as { data?: DataProduct } | null)?.data ?? null;
  const trustScore = (trustData as { score?: number; factors?: TrustScoreData["factors"] } | null)
    ? { score: (trustData as TrustScoreData).score, factors: (trustData as TrustScoreData).factors }
    : null;

  const handleRefreshTrust = async () => {
    setRefreshing(true);
    try {
      await fetch(`/api/products/${encodeURIComponent(productId)}/trust?refresh=true`);
    } finally {
      setRefreshing(false);
    }
  };

  const setTab = (t: Tab) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", t);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Product not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ padding: "var(--spacing-page, 24px)" }}>
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-xs mb-4 hover:underline w-fit"
        style={{ color: "var(--color-text-muted)" }}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Products
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
              {product.display_name}
            </h1>
            {trustScore && <TrustScoreBadge score={trustScore.score} size="lg" />}
          </div>
          {product.domain && (
            <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              {product.domain}
            </p>
          )}
        </div>
        <button
          onClick={handleRefreshTrust}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-50"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh trust
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--color-border)" }}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="px-3 py-2 text-sm font-medium transition-colors"
            style={{
              color: tab === id ? "var(--color-brand)" : "var(--color-text-muted)",
              borderBottom: tab === id ? "2px solid var(--color-brand)" : "2px solid transparent",
              background: "transparent",
              marginBottom: "-1px",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "overview" && <OverviewTab product={product} trustScore={trustScore} />}
        {tab === "incidents" && <IncidentsTab productId={productId} />}
        {tab === "lineage" && <LineageTab productId={productId} />}
        {tab === "evidence" && <EvidenceTab productId={productId} />}
      </div>
    </div>
  );
}
