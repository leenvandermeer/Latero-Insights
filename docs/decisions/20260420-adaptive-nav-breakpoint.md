# LADR-013 — Adaptive navigation breakpoints: sidebar expanded threshold raised to 1280px

**Datum:** 2026-04-20
**Status:** ACCEPTED
**Owner:** Layer2 Meta Insights product
**Related:** [LINS-011](../requirements/insights-product.md#lins-011--adaptive-navigation)

## Context

LINS-011 (v0.8) specified ≥1024px as the threshold for an expanded sidebar (256px). In practice this leaves insufficient content width for the dashboard grid on common laptop resolutions:

| Device | Viewport (CSS px) | Content width with expanded sidebar |
|--------|-------------------|--------------------------------------|
| MacBook Air 13" (2560×1664, DPR 2) | 1280px | 1280 − 256 − 96px padding = **928px** ✓ |
| MacBook Pro 14" (3024×1964, DPR 2) | 1512px | 1512 − 256 − 96px = **1160px** ✓ |
| Common Windows laptop (1366×768, DPR 1) | 1366px | 1366 − 256 − 96px = **1014px** ✓ |
| Small Windows laptop (1280×800, DPR 1) | 1280px | **928px** ✓ |
| Tight viewport (1024px, DPR 1) | 1024px | 1024 − 256 − 96px = **672px** ✗ too narrow for 12-col grid |

At 1024px with an expanded 256px sidebar, the widget grid receives only ~672px — insufficient for a meaningful 12-column layout. The previous threshold was set without accounting for sidebar + padding overhead.

Market standard for expanded-sidebar thresholds: Grafana uses 1200px, Notion uses 1260px, Linear uses 1280px.

## Decision

Raise the sidebar auto-expand threshold from 1024px to **1280px** (`xl` breakpoint).

**New adaptive navigation model (supersedes LINS-011 table):**

| Viewport | Navigation | User control |
|----------|-----------|--------------|
| ≥ 1280px (`xl`+) | Sidebar expanded (256px), icon + label | Collapsible via chevron; preference persisted |
| 1024px–1279px (`lg`) | Sidebar collapsed (64px, icons only) | User MAY expand manually; not persisted across resize |
| 768px–1023px (`md`) | Sidebar collapsed (64px, icons only) | Collapse is forced; no expand button shown |
| < 768px (`sm`) | Bottom navigation bar | N/A |

**Implementation:**
- `useBreakpoint` gains `isSmallDesktop: breakpoint === "lg"` (1024–1279px).
- Sidebar auto-collapses when `breakpoint === "md" || breakpoint === "lg"`.
- The collapse toggle button is hidden at `md` (always collapsed); shown at `lg` and above.
- User preference (`sidebar-collapsed` in localStorage) is only read and written at `xl`+.

## Consequences

- Dashboard grid receives ≥928px at all supported desktop viewports — sufficient for 12-column layout.
- MacBook Pro 13"/14", common 1366px Windows laptops, and 1280px screens all get an appropriate default state.
- Users on 1024–1279px screens start with a collapsed sidebar but can expand if they need labels — the expand button is visible.
- `LINS-011` table updated to reflect new thresholds; `useBreakpoint` gains `isSmallDesktop` helper.
