/**
 * Centralized chart/status colors.
 * These match the CSS vars in globals.css but are needed as hex strings
 * for Recharts which doesn't support CSS variables.
 */
export const STATUS_COLORS = {
  SUCCESS: "#10B981",
  WARNING: "#F59E0B",
  FAILED: "#EF4444",
} as const;

export const STATUS_BG = {
  SUCCESS: "rgba(16,185,129,0.1)",
  WARNING: "rgba(245,158,11,0.1)",
  FAILED: "rgba(239,68,68,0.1)",
} as const;

export type StatusKey = keyof typeof STATUS_COLORS;

/** Normalise live values (PASS/WARN/FAIL) to canonical spec values (SUCCESS/WARNING/FAILED). */
export function normalizeStatus(status: string): "SUCCESS" | "WARNING" | "FAILED" | string {
  switch (status.toUpperCase()) {
    case "PASS":    return "SUCCESS";
    case "WARN":    return "WARNING";
    case "FAIL":
    case "ERROR":   return "FAILED";
    default:        return status.toUpperCase();
  }
}

export const BRAND_COLORS = {
  primary: "#1B3B6B",
  accent: "#C8892A",
} as const;
