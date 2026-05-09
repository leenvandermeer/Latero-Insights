"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ChevronLeft, RefreshCw, AlertTriangle, Shield } from "lucide-react";
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
    <div className="flex flex-col gap-2">
      {isLoading && (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading incidents…</p>
      )}
      {!isLoading && (!incidents || incidents.length === 0) && (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          No incidents recorded for this product.
        </p>
      )}
      {incidents?.map((inc) => <IncidentRow key={inc.id} incident={inc as Incident} />)}
    </div>
  );
}

// ── Placeholder tabs ──────────────────────────────────────────────────────────

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        {label} — coming soon
      </p>
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
        onClick={() => router.push("/products")}
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
        {tab === "lineage" && <PlaceholderTab label="Lineage graph" />}
        {tab === "evidence" && <PlaceholderTab label="Evidence ledger" />}
      </div>
    </div>
  );
}
