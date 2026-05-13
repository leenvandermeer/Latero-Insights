/**
 * Overview Tab Component for Entity Detail Hub
 *
 * Shows:
 * - Context panel (metadata)
 * - Quick stats cards
 * - Recent activity timeline
 */

import {
  User,
  Shield,
  Calendar,
  Tag,
  Database,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity as ActivityIcon,
} from "lucide-react";

interface OverviewTabProps {
  entity: any;
  product: any;
  runs: any[];
  successRate: number | null;
  lastRun: any;
  openIssuesCount: number;
}

export function OverviewTab({
  entity,
  product,
  runs,
  successRate,
  lastRun,
  openIssuesCount,
}: OverviewTabProps) {
  if (!entity) {
    return (
      <div className="text-center py-12" style={{ color: "var(--color-text-muted)" }}>
        Entity not found
      </div>
    );
  }

  const totalRuns = runs.length;
  const successfulRuns = runs.filter((r) => r.status === "SUCCESS").length;
  const failedRuns = runs.filter((r) => r.status === "FAILED").length;

  return (
    <div className="space-y-6">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Success Rate"
          value={successRate !== null ? `${successRate}%` : "—"}
          status={
            successRate === null
              ? "neutral"
              : successRate >= 95
              ? "success"
              : successRate >= 80
              ? "warning"
              : "error"
          }
        />
        <StatCard
          label="Total Runs"
          value={totalRuns}
          sublabel={`${successfulRuns} passed, ${failedRuns} failed`}
          status="neutral"
        />
        <StatCard
          label="Last Run"
          value={lastRun ? formatRelativeTime(lastRun.ended_at) : "Never"}
          sublabel={lastRun?.status}
          status={
            !lastRun
              ? "neutral"
              : lastRun.status === "SUCCESS"
              ? "success"
              : lastRun.status === "FAILED"
              ? "error"
              : "warning"
          }
        />
        <StatCard
          label="Open Issues"
          value={openIssuesCount}
          status={openIssuesCount > 0 ? "warning" : "success"}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Context Panel (2/3 width) */}
        <div className="lg:col-span-2">
          <ContextPanel entity={entity} product={product} />
        </div>

        {/* Recent Activity (1/3 width) */}
        <div>
          <RecentActivity runs={runs.slice(0, 10)} />
        </div>
      </div>

      {/* Member Entities (if this is a product) */}
      {product && product.entity_ids && product.entity_ids.length > 0 && (
        <MemberEntitiesSection productId={product.data_product_id} />
      )}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  status?: "success" | "warning" | "error" | "neutral";
}

function StatCard({ label, value, sublabel, status = "neutral" }: StatCardProps) {
  const statusColors = {
    success: { bg: "rgba(16,185,129,0.08)", border: "#86efac", text: "#059669" },
    warning: { bg: "rgba(245,158,11,0.08)", border: "#fde047", text: "#d97706" },
    error: { bg: "rgba(239,68,68,0.08)", border: "#fca5a5", text: "#dc2626" },
    neutral: { bg: "var(--color-surface)", border: "var(--color-border)", text: "var(--color-text)" },
  };

  const colors = statusColors[status];

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </div>
      <div className="text-2xl font-bold mb-1" style={{ color: colors.text }}>
        {value}
      </div>
      {sublabel && (
        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

// ── Context Panel ─────────────────────────────────────────────────────────────

function ContextPanel({ entity, product }: { entity: any; product: any }) {
  const contextItems = [
    { icon: User, label: "Owner", value: product?.owner ?? entity?.owner ?? "—" },
    { icon: Shield, label: "Data Steward", value: product?.data_steward ?? "—" },
    { icon: Database, label: "Product", value: product?.display_name ?? "—" },
    { icon: Tag, label: "Classification", value: product?.classification ?? "—" },
    { icon: Calendar, label: "SLA Tier", value: product?.sla_tier ?? "—" },
    { icon: Clock, label: "Retention", value: product?.retention_days ? `${product.retention_days} days` : "—" },
  ];

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text)" }}>
        Context
      </h2>

      {/* Description */}
      {(entity?.description || product?.description) && (
        <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--color-text)" }}>
          {entity?.description || product?.description}
        </p>
      )}

      {/* Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contextItems.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-3">
            <div
              className="rounded-lg p-2 flex-shrink-0"
              style={{ background: "var(--color-surface)" }}
            >
              <Icon className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium mb-0.5" style={{ color: "var(--color-text-muted)" }}>
                {label}
              </div>
              <div className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                {value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tags */}
      {product?.tags && product.tags.length > 0 && (
        <div className="mt-6">
          <div className="text-xs font-medium mb-2" style={{ color: "var(--color-text-muted)" }}>
            Tags
          </div>
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag: string) => (
              <span
                key={tag}
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  background: "var(--color-surface-alt)",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Recent Activity ───────────────────────────────────────────────────────────

function RecentActivity({ runs }: { runs: any[] }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text)" }}>
        Recent Activity
      </h2>

      {runs.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: "var(--color-text-muted)" }}>
          No recent activity
        </p>
      )}

      <div className="space-y-3">
        {runs.map((run) => (
          <div
            key={run.run_id}
            className="flex items-start gap-3 pb-3 border-b last:border-b-0"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="flex-shrink-0 mt-0.5">
              {run.status === "SUCCESS" ? (
                <CheckCircle2 className="h-4 w-4" style={{ color: "#059669" }} />
              ) : run.status === "FAILED" ? (
                <XCircle className="h-4 w-4" style={{ color: "#dc2626" }} />
              ) : (
                <AlertTriangle className="h-4 w-4" style={{ color: "#d97706" }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium mb-0.5" style={{ color: "var(--color-text)" }}>
                Run {run.status.toLowerCase()}
              </div>
              <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {formatRelativeTime(run.ended_at)}
                {run.duration_ms && ` • ${formatDuration(run.duration_ms)}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Member Entities Section ───────────────────────────────────────────────────

function MemberEntitiesSection({ productId }: { productId: string }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text)" }}>
        Member Entities
      </h2>
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        Member entities will be shown here (TODO: implement)
      </p>
    </div>
  );
}

// ── Utility Functions ─────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
