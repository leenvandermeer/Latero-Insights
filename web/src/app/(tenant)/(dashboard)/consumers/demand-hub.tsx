"use client";

import { useState } from "react";
import { Users, BarChart3, Search, Plus, X, CheckCircle, Clock, XCircle, UserPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataProducts } from "@/hooks/use-data-products";

// ---------------------------------------------------------------------------
// Types — aligned to API responses
// ---------------------------------------------------------------------------

interface ProductConsumer {
  consumer_id: string;
  consumer_type: "team" | "system" | "person";
  registered_at: string;
  event_count: number;
  last_access_at: string | null;
}

interface ProductUsageDay {
  day: string;
  event_count: number;
  unique_consumers: number;
}

interface ContractRequest {
  id: number;
  consumer_id: string;
  requirements: Record<string, unknown>;
  status: "pending" | "approved" | "declined";
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface DataProduct {
  data_product_id: string;
  display_name: string;
}

const CONSUMER_TYPE_LABELS: Record<string, string> = {
  team:   "Team",
  system: "System",
  person: "Person",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error("Request failed");
  return res.json() as Promise<T>;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Usage sparkline
// ---------------------------------------------------------------------------

function UsageSparkline({ days }: { days: ProductUsageDay[] }) {
  if (!days || days.length === 0) return null;
  const recent = [...days].sort((a, b) => a.day.localeCompare(b.day)).slice(-30);
  const max = Math.max(...recent.map((d) => d.event_count), 1);
  return (
    <div className="flex items-end gap-px h-8">
      {recent.map((d) => (
        <div
          key={d.day}
          className="flex-1 rounded-sm min-w-0"
          style={{
            height: `${Math.max(3, (d.event_count / max) * 32)}px`,
            background: "var(--color-brand)",
            opacity: 0.3 + 0.7 * (d.event_count / max),
          }}
          title={`${d.day}: ${d.event_count} events, ${d.unique_consumers} consumers`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register consumer modal
// ---------------------------------------------------------------------------

function RegisterConsumerModal({
  productId,
  onClose,
}: {
  productId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [consumerId, setConsumerId] = useState("");
  const [consumerType, setConsumerType] = useState<"team" | "system" | "person">("team");

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/products/${encodeURIComponent(productId)}/consumers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consumer_id: consumerId.trim(), consumer_type: consumerType }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consumers", productId] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Register consumer</h2>
          <button onClick={onClose}><X className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} /></button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); if (consumerId.trim()) mutation.mutate(); }}
          className="flex flex-col gap-3"
        >
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
              Consumer ID *
            </label>
            <input
              required
              type="text"
              value={consumerId}
              onChange={(e) => setConsumerId(e.target.value)}
              placeholder="e.g. team-risk, svc-reporting, john.doe"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>Type</label>
            <select
              value={consumerType}
              onChange={(e) => setConsumerType(e.target.value as typeof consumerType)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            >
              {Object.entries(CONSUMER_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {mutation.isError && (
            <p className="text-xs" style={{ color: "#b91c1c" }}>Failed to register. Try again.</p>
          )}
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
              disabled={mutation.isPending || !consumerId.trim()}
              className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--color-brand)", color: "#fff" }}
            >
              {mutation.isPending ? "Saving…" : "Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contract requests section
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<ContractRequest["status"], { label: string; Icon: React.ElementType; color: string }> = {
  pending:  { label: "Pending",  Icon: Clock,        color: "#a16207" },
  approved: { label: "Approved", Icon: CheckCircle,  color: "#047857" },
  declined: { label: "Declined", Icon: XCircle,      color: "#b91c1c" },
};

function ContractRequestRow({
  req,
  productId,
}: {
  req: ContractRequest;
  productId: string;
}) {
  const qc = useQueryClient();
  const cfg = STATUS_CONFIG[req.status];

  const resolve = useMutation({
    mutationFn: (status: "approved" | "declined") =>
      apiFetch(`/api/products/${encodeURIComponent(productId)}/contract-requests/${req.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract-requests", productId] }),
  });

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 border-b last:border-0"
      style={{ borderColor: "var(--color-border)" }}
    >
      <cfg.Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: cfg.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{req.consumer_id}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          {formatDate(req.created_at)}
          {req.resolved_by ? ` · Resolved by ${req.resolved_by}` : ""}
        </p>
        {Object.keys(req.requirements).length > 0 && (
          <p className="text-xs mt-1 font-mono" style={{ color: "var(--color-text-muted)" }}>
            {Object.entries(req.requirements)
              .slice(0, 3)
              .map(([k, v]) => `${k}: ${String(v)}`)
              .join(" · ")}
          </p>
        )}
      </div>
      {req.status === "pending" && (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => resolve.mutate("approved")}
            disabled={resolve.isPending}
            className="text-[11px] px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
            style={{ background: "#d1fae5", color: "#047857" }}
          >
            Approve
          </button>
          <button
            onClick={() => resolve.mutate("declined")}
            disabled={resolve.isPending}
            className="text-[11px] px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
            style={{ background: "#fee2e2", color: "#b91c1c" }}
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product detail panel
// ---------------------------------------------------------------------------

type DetailTab = "consumers" | "usage" | "requests";

function ProductDemandPanel({ productId }: { productId: string }) {
  const [tab, setTab] = useState<DetailTab>("consumers");
  const [showRegister, setShowRegister] = useState(false);

  const { data: consumers = [] } = useQuery<ProductConsumer[]>({
    queryKey: ["consumers", productId],
    queryFn: () =>
      apiFetch<{ data: ProductConsumer[] }>(`/api/products/${encodeURIComponent(productId)}/consumers`)
        .then((r) => r.data ?? []),
    staleTime: 30_000,
    retry: 1,
  });

  const { data: usage = [] } = useQuery<ProductUsageDay[]>({
    queryKey: ["usage", productId],
    queryFn: () =>
      apiFetch<{ data: ProductUsageDay[] }>(`/api/products/${encodeURIComponent(productId)}/usage`)
        .then((r) => r.data ?? []),
    staleTime: 30_000,
    retry: 1,
  });

  const { data: contractRequests = [] } = useQuery<ContractRequest[]>({
    queryKey: ["contract-requests", productId],
    queryFn: () =>
      apiFetch<{ data: ContractRequest[] }>(`/api/products/${encodeURIComponent(productId)}/contract-requests`)
        .then((r) => r.data ?? []),
    staleTime: 30_000,
    retry: 1,
  });

  const totalEvents = usage.reduce((s, d) => s + d.event_count, 0);
  const lastAccess = consumers[0]?.last_access_at ?? null;
  const pendingCount = contractRequests.filter((r) => r.status === "pending").length;

  const DETAIL_TABS: { id: DetailTab; label: string; badge?: number }[] = [
    { id: "consumers", label: "Consumers", badge: consumers.length },
    { id: "usage",     label: "Usage" },
    { id: "requests",  label: "Requests", badge: pendingCount || undefined },
  ];

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-3 p-4">
        {[
          { label: "Consumers",    value: consumers.length },
          { label: "Events (30d)", value: totalEvents },
          { label: "Last access",  value: formatDate(lastAccess) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl p-3"
            style={{ background: "var(--color-surface-subtle)", border: "1px solid var(--color-border)" }}
          >
            <p className="text-[10px] uppercase font-bold tracking-wide" style={{ color: "var(--color-text-muted)" }}>
              {label}
            </p>
            <p className="text-lg font-bold tabular-nums mt-1 truncate" style={{ color: "var(--color-text)" }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div
        className="flex items-center gap-0 px-4 border-b shrink-0"
        style={{ borderColor: "var(--color-border)" }}
      >
        {DETAIL_TABS.map(({ id, label, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
            style={{
              color: tab === id ? "var(--color-brand)" : "var(--color-text-muted)",
              borderBottom: tab === id ? "2px solid var(--color-brand)" : "2px solid transparent",
              marginBottom: "-1px",
              background: "transparent",
            }}
          >
            {label}
            {badge != null && badge > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  background: id === "requests" ? "#fee2e2" : "var(--color-surface-subtle)",
                  color: id === "requests" ? "#b91c1c" : "var(--color-text-muted)",
                }}
              >
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "consumers" && (
          <>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "var(--color-border)" }}>
              <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                Registered consumers
              </span>
              <button
                onClick={() => setShowRegister(true)}
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: "var(--color-brand)" }}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Register
              </button>
            </div>
            {consumers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Users className="h-6 w-6" style={{ color: "var(--color-text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No consumers registered yet.</p>
                <button
                  onClick={() => setShowRegister(true)}
                  className="text-xs font-medium mt-1"
                  style={{ color: "var(--color-brand)" }}
                >
                  Register the first consumer
                </button>
              </div>
            ) : (
              consumers.map((c) => (
                <div
                  key={c.consumer_id}
                  className="flex items-center gap-3 px-4 py-3 border-b last:border-0"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                      {c.consumer_id}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      {CONSUMER_TYPE_LABELS[c.consumer_type] ?? c.consumer_type}
                      {" · "}Registered {formatDate(c.registered_at)}
                    </p>
                  </div>
                  <div className="text-right text-xs shrink-0" style={{ color: "var(--color-text-muted)" }}>
                    <p className="font-medium tabular-nums">{c.event_count} events</p>
                    <p>{formatDate(c.last_access_at)}</p>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {tab === "usage" && (
          <div className="p-4 flex flex-col gap-4">
            {usage.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: "var(--color-text-muted)" }}>
                No usage events recorded yet.
              </p>
            ) : (
              <>
                <div
                  className="rounded-xl p-4"
                  style={{ background: "var(--color-surface-subtle)", border: "1px solid var(--color-border)" }}
                >
                  <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
                    Daily events — last 30 days
                  </p>
                  <UsageSparkline days={usage} />
                </div>
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  <div className="grid grid-cols-3 px-4 py-2 text-[10px] uppercase font-bold tracking-wide"
                    style={{ background: "var(--color-surface-subtle)", color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)" }}>
                    <span>Date</span>
                    <span className="text-right">Events</span>
                    <span className="text-right">Consumers</span>
                  </div>
                  {[...usage]
                    .sort((a, b) => b.day.localeCompare(a.day))
                    .slice(0, 14)
                    .map((d) => (
                      <div
                        key={d.day}
                        className="grid grid-cols-3 px-4 py-2.5 text-xs border-b last:border-0"
                        style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
                      >
                        <span style={{ color: "var(--color-text-muted)" }}>{d.day}</span>
                        <span className="text-right tabular-nums">{d.event_count}</span>
                        <span className="text-right tabular-nums">{d.unique_consumers}</span>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "requests" && (
          <>
            <div className="px-4 py-2.5 border-b text-xs font-medium" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
              Contract requests
            </div>
            {contractRequests.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: "var(--color-text-muted)" }}>
                No contract requests yet.
              </p>
            ) : (
              contractRequests.map((req) => (
                <ContractRequestRow key={req.id} req={req} productId={productId} />
              ))
            )}
          </>
        )}
      </div>

      {showRegister && (
        <RegisterConsumerModal productId={productId} onClose={() => setShowRegister(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DemandHub
// ---------------------------------------------------------------------------

export function DemandHub() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: productsResponse, isLoading } = useDataProducts();
  const products = ((productsResponse as { data?: DataProduct[] } | null)?.data ?? []) as DataProduct[];

  const filtered = products.filter(
    (p) => !search || p.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProduct = products.find((p) => p.data_product_id === selectedId);

  return (
    <div className="page-content flex h-full flex-col overflow-x-hidden">
      <div
        className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[260px_minmax(0,1fr)]"
      >
        {/* Product list */}
        <div
          className="flex min-h-0 flex-col rounded-xl border overflow-hidden"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0"
            style={{ borderColor: "var(--color-border)" }}
          >
            <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-text-muted)" }} />
            <input
              type="text"
              placeholder="Filter products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--color-text)" }}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading && (
              <p className="px-2 py-4 text-xs" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
            )}
            {!isLoading && filtered.length === 0 && (
              <p className="px-2 py-4 text-xs" style={{ color: "var(--color-text-muted)" }}>No matching products.</p>
            )}
            {filtered.map((p) => (
              <button
                key={p.data_product_id}
                onClick={() => setSelectedId(p.data_product_id)}
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
                style={{
                  background: selectedId === p.data_product_id ? "var(--color-sidebar-hover)" : "transparent",
                  color: selectedId === p.data_product_id ? "var(--color-brand)" : "var(--color-text)",
                  fontWeight: selectedId === p.data_product_id ? 600 : 400,
                }}
              >
                {p.display_name}
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div
          className="min-h-0 rounded-xl border overflow-hidden flex flex-col"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          {!selectedId ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <Users className="h-8 w-8" style={{ color: "var(--color-text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Select a product to view consumer analytics
              </p>
            </div>
          ) : (
            <>
              <div
                className="flex items-center gap-2 px-4 py-3 border-b shrink-0"
                style={{ borderColor: "var(--color-border)" }}
              >
                <BarChart3 className="h-4 w-4" style={{ color: "var(--color-brand)" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  {selectedProduct?.display_name}
                </h2>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <ProductDemandPanel productId={selectedId} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
