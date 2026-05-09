"use client";

// Trust Score Sparkline — minimal line chart of historical scores
// Pure SVG, no external chart lib dependency.

interface TrustScoreSparklineProps {
  history: { score: number; computed_at: string }[];
  width?: number;
  height?: number;
}

export function TrustScoreSparkline({
  history,
  width = 80,
  height = 28,
}: TrustScoreSparklineProps) {
  if (!history || history.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line
          x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke="var(--color-border)" strokeWidth={1.5} strokeDasharray="3 2"
        />
      </svg>
    );
  }

  const scores = history.map((h) => h.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  const pad = 2;
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;

  const points = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * usableW;
    const y = pad + (1 - (s - min) / range) * usableH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const latest = scores[scores.length - 1];
  const stroke =
    latest >= 90 ? "#16a34a" : latest >= 70 ? "#2563eb" : latest >= 40 ? "#ca8a04" : "#dc2626";

  const lastX = parseFloat(points[points.length - 1].split(",")[0]);
  const lastY = parseFloat(points[points.length - 1].split(",")[1]);

  return (
    <svg width={width} height={height} aria-label={`Trust score trend: ${latest}`}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill={stroke} />
    </svg>
  );
}
