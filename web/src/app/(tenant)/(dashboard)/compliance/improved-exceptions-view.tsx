"use client";

import { useState, useMemo } from "react";
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Search,
  Calendar, MoreVertical, Check, X, Loader2, ChevronRight,
  RefreshCw, Trash2, Eye
} from "lucide-react";
import { useExceptions, useResolveException } from "@/hooks/use-compliance";
import type { PolicyException } from "@/lib/api/policies";

type ExceptionStatus = "pending" | "approved" | "declined";

interface ImprovedExceptionsViewProps {
  // Can be extended with props if needed
}

export function ImprovedExceptionsView({}: ImprovedExceptionsViewProps) {
  const [statusFilter, setStatusFilter] = useState<"" | ExceptionStatus>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailModalId, setDetailModalId] = useState<number | null>(null);

  const { data: allExceptions = [], isLoading } = useExceptions(statusFilter || undefined);
  const resolve = useResolveException();

  // Filter by search query
  const exceptions = useMemo(() => {
    if (!searchQuery) return allExceptions;
    const q = searchQuery.toLowerCase();
    return allExceptions.filter(
      (ex) =>
        ex.justification?.toLowerCase().includes(q) ||
        ex.product_id?.toLowerCase().includes(q) ||
        ex.policy_id?.toLowerCase().includes(q) ||
        (ex as any).policy_name?.toLowerCase().includes(q)
    );
  }, [allExceptions, searchQuery]);

  const pending = allExceptions.filter((e) => e.status === "pending").length;
  const approved = allExceptions.filter((e) => e.status === "approved").length;
  const declined = allExceptions.filter((e) => e.status === "declined").length;
  const expiringSoon = allExceptions.filter(
    (e) =>
      e.status === "approved" &&
      new Date(e.expiry_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  ).length;

  const toggleSelection = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === exceptions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(exceptions.map((e) => e.id)));
    }
  };

  const handleBulkAction = async (action: "approve" | "decline") => {
    for (const id of selectedIds) {
      await resolve.mutateAsync({ id, status: action === "approve" ? "approved" : "declined" });
    }
    setSelectedIds(new Set());
  };

  const handleStatusToggle = (ex: PolicyException, newStatus: ExceptionStatus) => {
    resolve.mutate({ id: ex.id, status: newStatus as "approved" | "declined" });
  };

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
      {/* Header with stats + search */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
        {/* Stats chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {([
            ["", `All (${allExceptions.length})`],
            ["pending", `⏳ Pending (${pending})`],
            ["approved", `✓ Approved (${approved})`],
            ["declined", `✗ Declined (${declined})`],
          ] as [typeof statusFilter, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setStatusFilter(id)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: statusFilter === id ? "var(--color-brand)" : "var(--color-surface-raised)",
                color: statusFilter === id ? "#fff" : "var(--color-text-muted)",
                border: statusFilter === id ? "none" : "1px solid var(--color-border)",
              }}
            >
              {label}
            </button>
          ))}
          {expiringSoon > 0 && (
            <div
              className="rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
              style={{ background: "#fef9c3", color: "#a16207", border: "1px solid #fde047" }}
            >
              <AlertTriangle className="h-3 w-3" />
              {expiringSoon} expiring soon
            </div>
          )}
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            type="text"
            placeholder="Search exceptions (policy, product, justification...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg outline-none transition-all"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div
          className="px-4 py-2.5 flex items-center gap-3 border-b"
          style={{ background: "rgba(27,59,107,0.05)", borderColor: "var(--color-border)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => handleBulkAction("approve")}
            disabled={resolve.isPending}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-all"
            style={{ background: "rgba(16,185,129,0.15)", color: "#059669" }}
          >
            <Check className="h-3.5 w-3.5" /> Approve All
          </button>
          <button
            onClick={() => handleBulkAction("decline")}
            disabled={resolve.isPending}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-all"
            style={{ background: "rgba(239,68,68,0.12)", color: "#dc2626" }}
          >
            <X className="h-3.5 w-3.5" /> Decline All
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs font-medium"
            style={{ color: "var(--color-text-muted)" }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Exception cards list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && (
          <div className="flex items-center gap-2 justify-center py-12 text-sm" style={{ color: "var(--color-text-muted)" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Loading exceptions...
          </div>
        )}

        {!isLoading && exceptions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <CheckCircle2 className="h-10 w-10" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
              No exceptions found
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {searchQuery ? "Try adjusting your search" : "All policies are being followed"}
            </p>
          </div>
        )}

        {/* Select all checkbox (when items exist) */}
        {exceptions.length > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={selectedIds.size === exceptions.length && exceptions.length > 0}
              onChange={selectAll}
              className="h-4 w-4 rounded"
              style={{ accentColor: "var(--color-brand)" }}
            />
            <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              Select all
            </span>
          </div>
        )}

        {exceptions.map((ex) => (
          <ExceptionCard
            key={ex.id}
            exception={ex}
            selected={selectedIds.has(ex.id)}
            onToggleSelection={() => toggleSelection(ex.id)}
            onStatusChange={(status) => handleStatusToggle(ex, status)}
            onViewDetail={() => setDetailModalId(ex.id)}
            resolving={resolve.isPending}
          />
        ))}
      </div>
    </div>
  );
}

// ── Exception Card Component ──────────────────────────────────────────────────

interface ExceptionCardProps {
  exception: PolicyException & { policy_name?: string; pack_name?: string };
  selected: boolean;
  onToggleSelection: () => void;
  onStatusChange: (status: ExceptionStatus) => void;
  onViewDetail: () => void;
  resolving: boolean;
}

function ExceptionCard({
  exception: ex,
  selected,
  onToggleSelection,
  onStatusChange,
  onViewDetail,
  resolving,
}: ExceptionCardProps) {
  const [showActions, setShowActions] = useState(false);

  const statusConfig = {
    approved: { bg: "#dcfce7", text: "#166534", border: "#86efac", icon: CheckCircle2 },
    declined: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5", icon: XCircle },
    pending: { bg: "#fef9c3", text: "#a16207", border: "#fde047", icon: Clock },
  }[ex.status];

  const isExpired = new Date(ex.expiry_date) < new Date();
  const isExpiringSoon =
    ex.status === "approved" &&
    new Date(ex.expiry_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const StatusIcon = statusConfig.icon;

  return (
    <div
      className="rounded-xl p-4 transition-all relative"
      style={{
        background: "var(--color-card)",
        border: `2px solid ${selected ? "var(--color-brand)" : statusConfig.border}`,
        opacity: ex.status === "declined" ? 0.7 : 1,
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelection}
          className="mt-1 h-4 w-4 rounded flex-shrink-0"
          style={{ accentColor: "var(--color-brand)" }}
        />

        {/* Status indicator */}
        <div
          className="rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 flex-shrink-0"
          style={{ background: statusConfig.bg }}
        >
          <StatusIcon className="h-3.5 w-3.5" style={{ color: statusConfig.text }} />
          <span className="text-xs font-semibold capitalize" style={{ color: statusConfig.text }}>
            {ex.status}
          </span>
        </div>

        {/* Policy + Product */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>
            {ex.policy_name ?? ex.policy_id}
          </div>
          <div className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
            {ex.product_id}
          </div>
        </div>

        {/* Actions menu */}
        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
          >
            <MoreVertical className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          </button>
          {showActions && (
            <div
              className="absolute right-0 top-8 rounded-lg shadow-lg z-10 py-1 min-w-[140px]"
              style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
            >
              <button
                onClick={() => {
                  onViewDetail();
                  setShowActions(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-black/5"
                style={{ color: "var(--color-text)" }}
              >
                <Eye className="h-3.5 w-3.5" /> View Details
              </button>
              {ex.status === "approved" && (
                <button
                  className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-black/5"
                  style={{ color: "var(--color-text)" }}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Extend +30d
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Justification */}
      <p className="text-sm mb-3 leading-relaxed" style={{ color: "var(--color-text)" }}>
        {ex.justification}
      </p>

      {/* Footer metadata */}
      <div className="flex items-center gap-4 flex-wrap text-xs" style={{ color: "var(--color-text-muted)" }}>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          Expires {new Date(ex.expiry_date).toLocaleDateString()}
          {isExpired && (
            <span className="font-semibold" style={{ color: "#b91c1c" }}>
              (expired)
            </span>
          )}
          {isExpiringSoon && !isExpired && (
            <span className="font-semibold" style={{ color: "#a16207" }}>
              (soon)
            </span>
          )}
        </div>
        {ex.approved_by && (
          <div>
            {ex.status === "approved" ? "Approved" : "Declined"} by {ex.approved_by}
          </div>
        )}
      </div>

      {/* Status toggle (for pending) */}
      {ex.status === "pending" && (
        <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
          <button
            onClick={() => onStatusChange("approved")}
            disabled={resolving}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg font-medium disabled:opacity-50 transition-all"
            style={{ background: "rgba(16,185,129,0.15)", color: "#059669" }}
          >
            <Check className="h-3.5 w-3.5" /> Approve
          </button>
          <button
            onClick={() => onStatusChange("declined")}
            disabled={resolving}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg font-medium disabled:opacity-50 transition-all"
            style={{ background: "rgba(239,68,68,0.12)", color: "#dc2626" }}
          >
            <X className="h-3.5 w-3.5" /> Decline
          </button>
        </div>
      )}

      {/* Re-open toggle (for approved/declined) */}
      {ex.status !== "pending" && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
          <button
            onClick={() => onStatusChange("pending")}
            disabled={resolving}
            className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg font-medium disabled:opacity-50 transition-all"
            style={{ background: "var(--color-surface)", color: "var(--color-text-muted)" }}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Re-open as Pending
          </button>
        </div>
      )}
    </div>
  );
}
