"use client";

// Trust Score Breakdown — factor list with visual indicators
import type { TrustFactor } from "@/hooks/use-trust-score";

interface TrustScoreBreakdownProps {
  score: number;
  factors: TrustFactor[];
}

function FactorRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span
        className="h-4 w-4 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold"
        style={{
          background: ok ? "#dcfce7" : "#fee2e2",
          color: ok ? "#166534" : "#b91c1c",
        }}
      >
        {ok ? "✓" : "✗"}
      </span>
      <span className="text-xs flex-1" style={{ color: "var(--color-text)" }}>
        {label}
      </span>
      {detail && (
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {detail}
        </span>
      )}
    </div>
  );
}

function ScoreBar({ value }: { value: number }) {
  const color =
    value >= 90 ? "#16a34a" : value >= 70 ? "#2563eb" : value >= 40 ? "#ca8a04" : "#dc2626";
  return (
    <div
      className="h-1.5 rounded-full overflow-hidden"
      style={{ background: "var(--color-border)" }}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  );
}

export function TrustScoreBreakdown({ score, factors }: TrustScoreBreakdownProps) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Trust Score
        </span>
        <span
          className="text-xl font-bold tabular-nums"
          style={{
            color:
              score >= 90 ? "#16a34a" : score >= 70 ? "#2563eb" : score >= 40 ? "#ca8a04" : "#dc2626",
          }}
        >
          {score}
        </span>
      </div>

      <ScoreBar value={score} />

      <div className="mt-3 divide-y" style={{ borderColor: "var(--color-border)" }}>
        {factors.map((factor) => (
          <FactorRow
            key={factor.id}
            label={factor.label}
            ok={factor.passed}
            detail={factor.delta < 0 ? `${factor.delta}` : undefined}
          />
        ))}
      </div>
    </div>
  );
}
