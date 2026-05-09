"use client";

// Trust Score Badge — compact numeric pill with colour-coded tier
// Score 0-100; tiers: <40 red (critical), 40-69 amber (moderate), 70-89 blue (good), ≥90 green (excellent)

interface TrustScoreBadgeProps {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

function tierStyle(score: number) {
  if (score >= 90) return { bg: "#dcfce7", text: "#166534", label: "Excellent" };
  if (score >= 70) return { bg: "#dbeafe", text: "#1d4ed8", label: "Good" };
  if (score >= 40) return { bg: "#fef9c3", text: "#a16207", label: "Moderate" };
  return { bg: "#fee2e2", text: "#b91c1c", label: "Critical" };
}

const SIZE_CLASSES = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2 py-0.5",
  lg: "text-sm px-3 py-1",
};

export function TrustScoreBadge({
  score,
  size = "md",
  showLabel = false,
}: TrustScoreBadgeProps) {
  if (score == null) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded-full ${SIZE_CLASSES[size]}`}
        style={{ background: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}
      >
        —
      </span>
    );
  }

  const { bg, text, label } = tierStyle(score);
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full ${SIZE_CLASSES[size]}`}
      style={{ background: bg, color: text }}
    >
      {score}
      {showLabel && <span className="font-normal opacity-80">· {label}</span>}
    </span>
  );
}
