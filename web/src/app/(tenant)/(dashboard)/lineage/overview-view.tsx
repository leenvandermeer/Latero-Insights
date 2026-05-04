"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Columns3,
  Database,
  Layers3,
  Minus,
  ShieldAlert,
  Table2,
} from "lucide-react";
import type { LineageAttribute, LineageEntity } from "@/lib/adapters/types";
import { lineageNodeName, lineageNodeLabel } from "./lineage-utils";

const LAYER_ORDER = ["landing", "raw", "bronze", "silver", "gold"];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  SUCCESS: { label: "Success", color: "#10B981", bg: "rgba(16,185,129,0.11)" },
  WARNING: { label: "Warning", color: "#F59E0B", bg: "rgba(245,158,11,0.13)" },
  PARTIAL: { label: "Partial", color: "#F59E0B", bg: "rgba(245,158,11,0.13)" },
  IN_PROGRESS: { label: "In progress", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  FAILED: { label: "Failed", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  UNKNOWN: { label: "Unknown", color: "var(--color-text-muted)", bg: "rgba(128,128,128,0.09)" },
};

type LineageOverviewProps = {
  entities: LineageEntity[];
  attributes: LineageAttribute[];
  refreshedAt?: string;
  onOpenTab: (tab: "graph" | "chains" | "columns") => void;
};

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function formatTime(value?: string | null) {
  if (!value) return "No recent success";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function formatLayer(layer: string) {
  if (!layer) return "Unknown";
  return layer.charAt(0).toUpperCase() + layer.slice(1);
}

function statusRank(status: string) {
  return { FAILED: 5, PARTIAL: 4, WARNING: 4, IN_PROGRESS: 3, UNKNOWN: 2, SUCCESS: 1 }[status.toUpperCase()] ?? 2;
}

function statusMeta(status: string) {
  return STATUS_META[status.toUpperCase()] ?? STATUS_META.UNKNOWN;
}

function worstEntityStatus(entity: LineageEntity) {
  return [entity.end_to_end_status, entity.latest_status]
    .sort((a, b) => statusRank(b) - statusRank(a))[0] ?? "UNKNOWN";
}

function uniqueEntities(entities: LineageEntity[]) {
  const byKey = new Map<string, LineageEntity>();
  for (const entity of entities) {
    const key = `${entity.layer.toLowerCase()}::${entity.name}`;
    const existing = byKey.get(key);
    if (!existing || statusRank(entity.end_to_end_status) > statusRank(existing.end_to_end_status)) {
      byKey.set(key, entity);
    }
  }
  return [...byKey.values()];
}

function datasetGroupKey(entity: LineageEntity) {
  return lineageNodeName(entity);
}

function readableChainName(chainEntities: LineageEntity[], fallback: string) {
  const terminalEntities = chainEntities
    .filter((entity) => entity.downstream_keys.length === 0)
    .sort((a, b) => statusRank(b.end_to_end_status) - statusRank(a.end_to_end_status));

  const preferred = terminalEntities[0] ?? [...chainEntities].sort((a, b) => {
    const aLayer = LAYER_ORDER.indexOf(a.layer.toLowerCase());
    const bLayer = LAYER_ORDER.indexOf(b.layer.toLowerCase());
    return bLayer - aLayer || a.name.localeCompare(b.name);
  })[0];

  return preferred ? lineageNodeLabel(preferred) : fallback;
}

function resolveDatasetChainStatus(chainEntities: LineageEntity[]) {
  const terminalEntities = chainEntities.filter((entity) =>
    !entity.downstream_keys.some((ref) =>
      chainEntities.some((candidate) => candidate.name === ref)
    )
  );
  const statusSource = terminalEntities.length > 0 ? terminalEntities : chainEntities;
  const latestStatuses = statusSource.map((entity) => entity.latest_status.toUpperCase());
  if (latestStatuses.includes("FAILED")) return "FAILED";
  if (latestStatuses.includes("PARTIAL")) return "PARTIAL";
  if (latestStatuses.includes("WARNING")) return "WARNING";
  if (latestStatuses.includes("IN_PROGRESS")) return "IN_PROGRESS";
  if (latestStatuses.length > 0 && latestStatuses.every((status) => status === "SUCCESS")) return "SUCCESS";
  return "UNKNOWN";
}

function MetricCard({
  label,
  value,
  detail,
  Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  const toneColor = {
    neutral: "var(--color-brand)",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
  }[tone];

  return (
    <div
      className="rounded-lg px-4 py-3 min-h-[116px]"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold leading-none" style={{ color: "var(--color-text)" }}>
            {value}
          </p>
        </div>
        <span
          className="grid h-9 w-9 place-items-center rounded-lg shrink-0"
          style={{ background: `${toneColor}1f`, color: toneColor }}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-xs leading-snug" style={{ color: "var(--color-text-muted)" }}>
        {detail}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}40` }}
    >
      <CircleDot className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-lg"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function TabAction({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
      style={{ color: "var(--color-brand)", border: "1px solid var(--color-border)" }}
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}

function ChainReadinessRow({
  chain,
}: {
  chain: {
    id: string;
    name: string;
    status: string;
    entities: number;
    layers: string[];
    coverage: number;
    latest: string | null;
  };
}) {
  const missingLayers = LAYER_ORDER.filter((layer) => !chain.layers.includes(layer));
  const coverageColor = chain.coverage === 100
    ? "#10B981"
    : chain.coverage >= 60
      ? "#F59E0B"
      : "#EF4444";

  return (
    <div className="px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold" style={{ color: "var(--color-text)" }} title={chain.id}>
              {chain.name}
            </p>
            <StatusPill status={chain.status} />
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            Dataset: {chain.id} ·{" "}
            {chain.entities} entities · {chain.layers.length} of {LAYER_ORDER.length} layers present
            {missingLayers.length > 0 ? ` · missing ${missingLayers.map(formatLayer).join(", ")}` : " · complete chain"}
          </p>
        </div>
        <div className="grid min-w-[160px] gap-1 text-left lg:text-right">
          <p className="text-2xl font-semibold leading-none" style={{ color: coverageColor }}>
            {chain.coverage}%
          </p>
          <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            Last success: {formatTime(chain.latest)}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div
          className="h-2 overflow-hidden rounded-full"
          style={{ background: "var(--color-surface)" }}
          aria-label={`Chain coverage ${chain.coverage}%`}
        >
          <div className="h-full rounded-full" style={{ width: `${chain.coverage}%`, background: coverageColor }} />
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {LAYER_ORDER.map((layer) => {
            const active = chain.layers.includes(layer);
            return (
              <div
                key={layer}
                className="flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5"
                style={{
                  background: active ? "var(--color-brand-subtle)" : "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: active ? "var(--color-brand)" : "var(--color-text-muted)",
                }}
                  title={active ? `${formatLayer(layer)} present` : `${formatLayer(layer)} missing`}
              >
                {active ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <Minus className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate text-[10px] font-semibold uppercase">{layer}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LineageOverview({ entities, attributes, refreshedAt, onOpenTab }: LineageOverviewProps) {
  const model = useMemo(() => {
    const currentAttributes = attributes.filter((attribute) => attribute.is_current);
    const currentEntities = uniqueEntities(entities);
    const total = currentEntities.length;
    const failed = currentEntities.filter((entity) => worstEntityStatus(entity) === "FAILED").length;
    const warning = currentEntities.filter((entity) => ["WARNING", "PARTIAL"].includes(worstEntityStatus(entity))).length;
    const inProgress = currentEntities.filter((entity) => worstEntityStatus(entity) === "IN_PROGRESS").length;
    const success = currentEntities.filter((entity) => worstEntityStatus(entity) === "SUCCESS").length;
    const unknown = Math.max(0, total - failed - warning - inProgress - success);
    const withLineage = currentEntities.filter((entity) => entity.upstream_keys.length > 0 || entity.downstream_keys.length > 0).length;

    const chains = new Map<string, LineageEntity[]>();
    for (const entity of currentEntities) {
      const key = datasetGroupKey(entity);
      chains.set(key, [...(chains.get(key) ?? []), entity]);
    }

    const chainRows = [...chains.entries()]
      .map(([id, chainEntities]) => {
        const worst = resolveDatasetChainStatus(chainEntities);
        const layers = [...new Set(chainEntities.map((entity) => entity.layer.toLowerCase()))];
        const coverage = pct(layers.length, LAYER_ORDER.length);
        const latest = chainEntities
          .map((entity) => entity.latest_success_at)
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => b.localeCompare(a))[0] ?? null;

        return {
          id,
          name: readableChainName(chainEntities, id),
          status: worst,
          entities: chainEntities.length,
          layers,
          coverage,
          latest,
        };
      })
      .sort((a, b) => statusRank(b.status) - statusRank(a.status) || a.coverage - b.coverage || a.name.localeCompare(b.name));

    const layerRows = LAYER_ORDER.map((layer) => {
      const layerEntities = currentEntities.filter((entity) => entity.layer.toLowerCase() === layer);
      return {
        layer,
        total: layerEntities.length,
        failed: layerEntities.filter((entity) => entity.latest_status === "FAILED" || entity.end_to_end_status === "FAILED").length,
        warning: layerEntities.filter((entity) => ["WARNING", "PARTIAL"].includes(entity.latest_status) || ["WARNING", "PARTIAL"].includes(entity.end_to_end_status)).length,
        success: layerEntities.filter((entity) => entity.latest_status === "SUCCESS").length,
      };
    }).filter((row) => row.total > 0);

    const riskiestEntities = [...currentEntities]
      .filter((entity) => entity.latest_status !== "SUCCESS" || entity.end_to_end_status !== "SUCCESS")
      .sort((a, b) => {
        const aDegree = a.upstream_keys.length + a.downstream_keys.length;
        const bDegree = b.upstream_keys.length + b.downstream_keys.length;
        return statusRank(b.end_to_end_status) - statusRank(a.end_to_end_status) || bDegree - aDegree;
      })
      .slice(0, 6);

    const topConnected = [...currentEntities]
      .sort((a, b) => {
        const aDegree = a.upstream_keys.length + a.downstream_keys.length;
        const bDegree = b.upstream_keys.length + b.downstream_keys.length;
        return bDegree - aDegree || a.name.localeCompare(b.name);
      })
      .slice(0, 5);

    return {
      total,
      failed,
      warning,
      inProgress,
      success,
      unknown,
      healthScore: pct(success, total),
      lineageCoverage: pct(withLineage, total),
      chains: chainRows,
      layerRows,
      riskiestEntities,
      topConnected,
      currentAttributes,
      uniqueSourceColumns: new Set(currentAttributes.map((attribute) => `${attribute.source_name}.${attribute.source_attribute}`)).size,
      uniqueTargetColumns: new Set(currentAttributes.map((attribute) => `${attribute.target_name}.${attribute.target_attribute}`)).size,
    };
  }, [attributes, entities]);

  const statusSegments = [
    { key: "success", label: "Success", value: model.success, color: "#10B981" },
    { key: "warning", label: "Warning", value: model.warning, color: "#F59E0B" },
    { key: "inProgress", label: "In progress", value: model.inProgress, color: "#3B82F6" },
    { key: "failed", label: "Failed", value: model.failed, color: "#EF4444" },
    { key: "unknown", label: "Unknown", value: model.unknown, color: "var(--color-text-muted)" },
  ];

  return (
    <div className="h-full overflow-auto" style={{ background: "var(--color-bg)" }}>
      <div className="mx-auto max-w-[1440px] space-y-4 px-4 py-4 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
              Lineage control room
            </p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight" style={{ color: "var(--color-text)" }}>
              End-to-end visibility across datasets, chains, and column impact
            </h1>
            <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--color-text-muted)" }}>
              Prioritize broken chains, review layer coverage, and move into graph, chains, or column lineage from the tabs above.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Health score"
            value={`${model.healthScore}%`}
            detail={`${model.success} of ${model.total} entities are fully successful.`}
            Icon={CheckCircle2}
            tone={model.healthScore >= 85 ? "success" : model.healthScore >= 60 ? "warning" : "error"}
          />
          <MetricCard
            label="Open risk"
            value={model.failed + model.warning}
            detail={`${model.failed} failed and ${model.warning} warning/partial signals.`}
            Icon={ShieldAlert}
            tone={model.failed > 0 ? "error" : model.warning > 0 ? "warning" : "success"}
          />
          <MetricCard
            label="Lineage coverage"
            value={`${model.lineageCoverage}%`}
            detail={`${model.chains.length} chains across ${model.total} unique layer entities.`}
            Icon={Layers3}
            tone={model.lineageCoverage >= 80 ? "success" : "warning"}
          />
          <MetricCard
            label="Column flows"
            value={model.currentAttributes.length}
            detail={`${model.uniqueSourceColumns} source columns mapped into ${model.uniqueTargetColumns} target columns.`}
            Icon={Columns3}
            tone="neutral"
          />
        </div>

        <section
          className="rounded-lg px-4 py-3"
          style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-[190px]">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                Status mix
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Last refresh: {formatTime(refreshedAt)}
              </p>
            </div>
            <div className="flex min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: "var(--color-surface)" }}>
              {statusSegments.map((segment) => (
                <div
                  key={segment.key}
                  title={`${segment.label}: ${segment.value}`}
                  style={{
                    width: `${pct(segment.value, model.total)}%`,
                    minWidth: segment.value > 0 ? 8 : 0,
                    background: segment.color,
                    height: 12,
                  }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {statusSegments.map((segment) => (
                <span key={segment.key} className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: segment.color }} />
                  {segment.label} {segment.value}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <Panel title="Layer coverage" action={<TabAction onClick={() => onOpenTab("graph")}>Open graph</TabAction>}>
            <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {model.layerRows.length === 0 ? (
                <p className="px-4 py-6 text-sm" style={{ color: "var(--color-text-muted)" }}>No layer data available.</p>
              ) : model.layerRows.map((row) => (
                <div key={row.layer} className="grid gap-3 px-4 py-3 md:grid-cols-[120px_minmax(0,1fr)_220px] md:items-center">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{formatLayer(row.layer)}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{row.total} entities</p>
                  </div>
                  <div className="flex h-2.5 overflow-hidden rounded-full" style={{ background: "var(--color-surface)" }}>
                    <div style={{ width: `${pct(row.success, row.total)}%`, background: "#10B981" }} />
                    <div style={{ width: `${pct(row.warning, row.total)}%`, background: "#F59E0B" }} />
                    <div style={{ width: `${pct(row.failed, row.total)}%`, background: "#EF4444" }} />
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    <span>{row.success} ok</span>
                    <span>{row.warning} warning</span>
                    <span>{row.failed} failed</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Needs attention" action={<TabAction onClick={() => onOpenTab("chains")}>Open chains</TabAction>}>
            <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {model.riskiestEntities.length === 0 ? (
                <div className="flex items-center gap-3 px-4 py-6">
                  <CheckCircle2 className="h-5 w-5" style={{ color: "#10B981" }} />
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No failed, warning, or partial entities found.</p>
                </div>
              ) : model.riskiestEntities.map((entity) => (
                <div key={`${entity.layer}:${entity.name}`} className="flex items-start gap-3 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: statusMeta(entity.end_to_end_status).color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium" style={{ color: "var(--color-text)" }} title={entity.name}>
                        {lineageNodeLabel(entity)}
                      </p>
                      <StatusPill status={entity.end_to_end_status} />
                    </div>
                    <p className="mt-1 truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {formatLayer(entity.layer)} · {entity.upstream_keys.length} upstream · {entity.downstream_keys.length} downstream
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Chain readiness" action={<TabAction onClick={() => onOpenTab("chains")}>Analyze chains</TabAction>}>
            <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {model.chains.length === 0 ? (
                <p className="px-4 py-6 text-sm" style={{ color: "var(--color-text-muted)" }}>No chains available.</p>
              ) : model.chains.slice(0, 5).map((chain) => <ChainReadinessRow key={chain.id} chain={chain} />)}
            </div>
          </Panel>

          <Panel title="Most connected entities" action={<TabAction onClick={() => onOpenTab("graph")}>View relationships</TabAction>}>
            <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {model.topConnected.map((entity) => {
                const degree = entity.upstream_keys.length + entity.downstream_keys.length;
                return (
                  <div key={`${entity.layer}:${entity.name}`} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_120px_90px] md:items-center">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-lg shrink-0" style={{ background: "var(--color-surface)", color: "var(--color-brand)" }}>
                        {entity.layer.toLowerCase() === "gold" ? <Table2 className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" style={{ color: "var(--color-text)" }} title={entity.name}>{lineageNodeLabel(entity)}</p>
                        <p className="truncate text-xs" style={{ color: "var(--color-text-muted)" }}>{formatLayer(entity.layer)}</p>
                      </div>
                    </div>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {entity.upstream_keys.length} up · {entity.downstream_keys.length} down
                    </p>
                    <p className="text-right text-sm font-semibold" style={{ color: "var(--color-text)" }}>{degree}</p>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
