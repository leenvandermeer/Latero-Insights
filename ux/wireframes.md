# Layer2 Meta Insights — UX Design Specification

> **Product:** Layer2 Meta Insights — Metadata observability for data pipelines
> **Primary users:** Data stewards, managers, auditors (business users)
> **Language:** English (all UI text)
> **Version:** 1.0
> **Date:** 2026-04-17

---

## 1. Design System

### 1.1 Color Palette

| Token              | Value       | Usage                                    |
| ------------------- | ----------- | ---------------------------------------- |
| `--brand`           | `#1B3B6B`   | Primary buttons, active nav, links       |
| `--brand-hover`     | `#143060`   | Button hover, link hover                 |
| `--brand-light`     | `#4B7BB5`   | Secondary actions, icon tint             |
| `--brand-subtle`    | `#DCE9F5`   | Active nav background, selected row      |
| `--accent`          | `#C8892A`   | CTA highlights, trend arrows, badges     |
| `--accent-light`    | `#D9A840`   | Accent hover                             |
| `--accent-subtle`   | `#FDF5E4`   | Accent background tint                   |
| `--bg`              | `#FDFAF4`   | Page background                          |
| `--surface`         | `#F5EFE4`   | Card background                          |
| `--surface-alt`     | `#ECE4D6`   | Alternate card, table stripe             |
| `--border`          | `#D6CCBA`   | Card borders, dividers                   |
| `--text`            | `#1A1208`   | Primary text                             |
| `--text-muted`      | `#4A3C2A`   | Secondary text, labels                   |
| `--text-subtle`     | `#8A7860`   | Placeholders, timestamps                 |
| `--success`         | `#10B981`   | Pass badges, success states              |
| `--warning`         | `#F59E0B`   | Warning badges, caution states           |
| `--error`           | `#EF4444`   | Failure badges, destructive actions      |

#### Dark Mode (`data-theme="dark"`)

| Token              | Dark Value  |
| ------------------- | ----------- |
| `--bg`              | `#0F0D08`   |
| `--surface`         | `#1A1710`   |
| `--surface-alt`     | `#242018`   |
| `--border`          | `#3A3428`   |
| `--text`            | `#F0EBE0`   |
| `--text-muted`      | `#B8AE9A`   |
| `--text-subtle`     | `#7A7060`   |
| `--brand-subtle`    | `#1A2A40`   |
| `--accent-subtle`   | `#2A2010`   |

### 1.2 Typography

| Role          | Font      | Weight | Size    | Line Height |
| ------------- | --------- | ------ | ------- | ----------- |
| Display H1    | Fraunces  | 700    | 32px    | 1.2         |
| Display H2    | Fraunces  | 600    | 24px    | 1.3         |
| Page title    | Fraunces  | 600    | 20px    | 1.3         |
| Section head  | Inter     | 600    | 16px    | 1.4         |
| Body          | Inter     | 400    | 14px    | 1.5         |
| Body small    | Inter     | 400    | 13px    | 1.5         |
| Caption       | Inter     | 400    | 12px    | 1.4         |
| Counter value | Fraunces  | 700    | 36px    | 1.1         |
| Badge         | Inter     | 500    | 11px    | 1.0         |

### 1.3 Spacing & Radius

| Token          | Value  |
| -------------- | ------ |
| `--space-xs`   | 4px    |
| `--space-sm`   | 8px    |
| `--space-md`   | 16px   |
| `--space-lg`   | 24px   |
| `--space-xl`   | 32px   |
| `--space-2xl`  | 48px   |
| `--radius-card`   | 16px  |
| `--radius-button` | 100px |
| `--radius-badge`  | 8px   |
| `--radius-input`  | 12px  |

### 1.4 Shadows

```
--shadow-card:    0 2px 8px  rgba(27, 59, 107, 0.06);
--shadow-hover:   0 4px 16px rgba(27, 59, 107, 0.10);
--shadow-drawer:  -4px 0 24px rgba(27, 59, 107, 0.12);
--shadow-dropdown: 0 8px 24px rgba(27, 59, 107, 0.14);
```

---

## 2. App Shell & Navigation

### 2.1 Desktop Layout (≥1024px)

```
┌──────────┬──────────────────────────────────────────────┐
│          │                                              │
│  ┌────┐  │  Page Content Area                           │
│  │LOGO│  │  (max-width: 1280px, centered)               │
│  └────┘  │                                              │
│          │  ┌─ PageHeader ─────────────────────────────┐│
│  ● Home  │  │ Title              [Filter▾] [Filter▾]  ││
│  ◦ Pipe  │  └─────────────────────────────────────────┘│
│  ◦ Qual  │                                              │
│  ◦ Lin.  │  ┌─ ContentGrid ──────────────────────────┐ │
│  ◦ OL    │  │                                        │ │
│  ◦ BCBS  │  │  (page-specific content)               │ │
│  ◦ Dash  │  │                                        │ │
│  ◦ Sett  │  └────────────────────────────────────────┘ │
│          │                                              │
│          │                                              │
│  ┌────┐  │                                              │
│  │ AV │  │                                              │
│  │ 🌙 │  │                                              │
│  └────┘  │                                              │
├──────────┤                                              │
│  260px   │                                              │
│  or 64px │                                              │
└──────────┴──────────────────────────────────────────────┘
```

**Sidebar states:**

- **Expanded** (260px): icon (20px Lucide) + label + optional count badge
- **Collapsed** (64px): icon only, tooltip on hover showing label
- **Toggle:** collapse button at bottom of sidebar (chevron icon)

**Active nav item:**
```
┌────────────────────────────┐
│▎ ■ Pipelines            12 │  ← brand-subtle bg
└────────────────────────────┘    ← 3px left accent bar (--brand)
                                  ← text color: --brand
```

**Inactive nav item:**
```
│  □ Quality                 │  ← transparent bg
                                 ← text color: --text-muted
                                 ← hover: --surface-alt bg
```

**Sidebar footer:**
```
┌────────────────────────────┐
│  ┌──┐                     │
│  │AV│  Jane Doe        ▾  │  ← user avatar (32px circle)
│  └──┘                     │
│       [☀ ───●── 🌙]       │  ← dark mode toggle
└────────────────────────────┘
```

### 2.2 Tablet Layout (768–1023px)

```
┌────┬────────────────────────────────────────────┐
│    │                                            │
│ ■  │  Page content (full remaining width)       │
│ □  │                                            │
│ □  │  Same as desktop but cards reflow          │
│ □  │  from 2-col to 1-col where needed          │
│ □  │                                            │
│ □  │                                            │
│ □  │                                            │
│    │                                            │
│ AV │                                            │
│ 🌙 │                                            │
├────┤                                            │
│64px│                                            │
└────┴────────────────────────────────────────────┘
```

- Sidebar always collapsed (64px, icons only)
- Tap icon → navigates immediately
- Long-press or dedicated expand button → expands overlay sidebar (260px) with backdrop
- Swipe right from left edge → opens overlay sidebar

### 2.3 Mobile Layout (<768px)

```
┌──────────────────────────────────────┐
│ ┌────┐               ┌──┐  ┌──┐     │ ← TopBar (56px)
│ │LOGO│               │🔔│  │☰ │     │
│ └────┘               └──┘  └──┘     │
├──────────────────────────────────────┤
│                                      │
│  Page content (single column)        │
│  Horizontal padding: 16px            │
│                                      │
│  Cards stack vertically              │
│  Counter row scrolls horizontally    │
│                                      │
│                                      │
│                                      │
├──────────────────────────────────────┤
│ ┌──────┬──────┬──────┬──────┬──────┐ │ ← BottomNav (64px + safe area)
│ │ Home │ Pipe │ Qual │ Lin. │ Dash │ │
│ │  ■   │  □   │  □   │  □   │  □   │ │   44px touch targets
│ └──────┴──────┴──────┴──────┴──────┘ │
└──────────────────────────────────────┘
```

**Hamburger menu (full-screen overlay):**
```
┌──────────────────────────────────────┐
│ ┌────┐                        ✕     │
│ │LOGO│                              │
│ └────┘                              │
│                                      │
│    Home                              │
│    Pipelines                         │
│    Quality                           │
│    Lineage                           │
│    OpenLineage                       │
│    BCBS239                           │
│    Dashboards                        │
│    Settings                          │
│                                      │
│    ────────────────                  │
│    Jane Doe                          │
│    [☀ ───●── 🌙]                     │
│                                      │
└──────────────────────────────────────┘
```

- Safe area padding: `env(safe-area-inset-bottom)` on BottomNav
- All interactive targets: minimum 44×44px
- No hover states — tap only

---

## 3. Home / Overview Page

### 3.1 Desktop (1440px)

```
┌──────────┬──────────────────────────────────────────────────────┐
│          │                                                      │
│ SIDEBAR  │  Welcome back, Jane                                  │
│          │  Last updated: 2026-04-17 06:05 UTC                  │
│          │                                                      │
│          │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│          │  │ ◉ Runs  │ │ ✓ Pass  │ │ ✕ Fail  │ │ ◎ DQ %  │   │
│          │  │   142   │ │   128   │ │    14   │ │  92.3%  │   │
│          │  │  ↑ 8%   │ │  ↑ 5%  │ │  ↓ 2   │ │  ↑ 1.2 │   │
│          │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│          │  ┌─────────┐                                         │
│          │  │⊡Lineage│                                          │
│          │  │   847  │                                          │
│          │  │  ↑ 12  │                                          │
│          │  └─────────┘                                         │
│          │                                                      │
│          │  ┌──────────────────────┐ ┌──────────────────────┐   │
│          │  │ Pipeline Trend (7d)  │ │ DQ Trend (7d)        │   │
│          │  │                      │ │                      │   │
│          │  │   ╱╲    ╱╲           │ │          ╱──╲        │   │
│          │  │  ╱  ╲──╱  ╲──        │ │    ╱────╱    ╲──     │   │
│          │  │ ╱              ╲     │ │ ──╱                  │   │
│          │  │                      │ │                      │   │
│          │  │ area: success/warn/  │ │ line: pass rate %    │   │
│          │  │       fail stacked   │ │ threshold: 90% dash  │   │
│          │  └──────────────────────┘ └──────────────────────┘   │
│          │                                                      │
│          │  ┌──────────────────────┐ ┌──────────────────────┐   │
│          │  │ Recent Failures      │ │ Notifications        │   │
│          │  │                      │ │                      │   │
│          │  │ step    dataset  dur │ │ 🔴 3 failures today  │   │
│          │  │ ────────────────────│ │ 🟡 DQ < 90% (eponl.) │   │
│          │  │ b2s   cbsener  FAIL │ │ 🟢 Lineage current   │   │
│          │  │ l2r   rvosde   FAIL │ │                      │   │
│          │  │ b2s   eponline FAIL │ │                      │   │
│          │  │ r2b   cbsener  WARN │ │                      │   │
│          │  │ b2s   rvosde   FAIL │ │                      │   │
│          │  │                      │ │                      │   │
│          │  │ [View all failures →]│ │                      │   │
│          │  └──────────────────────┘ └──────────────────────┘   │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

### 3.2 Mobile (<768px)

```
┌──────────────────────────────────────┐
│ LOGO                    🔔  ☰        │
├──────────────────────────────────────┤
│                                      │
│  Welcome back, Jane                  │
│                                      │
│  ← scroll horizontal →              │
│  ┌───────┐┌───────┐┌───────┐┌─────  │
│  │◉ Runs ││✓ Pass ││✕ Fail ││◎ DQ   │
│  │  142  ││  128  ││   14  ││ 92.   │
│  │ ↑ 8%  ││ ↑ 5%  ││ ↓ 2   ││ ↑ 1   │
│  └───────┘└───────┘└───────┘└─────  │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Pipeline Trend (7d)          │    │
│  │   ╱╲    ╱╲                   │    │
│  │  ╱  ╲──╱  ╲──               │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ DQ Trend (7d)                │    │
│  │          ╱──╲                │    │
│  │    ╱────╱    ╲──             │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Recent Failures              │    │
│  │  b2s / cbsenergie / FAIL    │    │
│  │  l2r / rvosde / FAIL        │    │
│  │  [View all →]               │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Notifications                │    │
│  │  🔴 3 failures today        │    │
│  │  🟡 DQ < 90%                │    │
│  └──────────────────────────────┘    │
│                                      │
├──────────────────────────────────────┤
│  Home   Pipe   Qual   Lin.   Dash   │
└──────────────────────────────────────┘
```

---

## 4. Pipeline Health View

### 4.1 Desktop (1440px)

```
┌──────────┬──────────────────────────────────────────────────────┐
│          │                                                      │
│ SIDEBAR  │  Pipeline Health                                     │
│          │  Monitor pipeline execution across environments      │
│          │                                          [7d ▾] [env ▾]
│          │                                                      │
│          │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│          │  │ Total   │ │ Success │ │ Warning │ │ Failed  │   │
│          │  │   142   │ │   128   │ │     6   │ │     8   │   │
│          │  │         │ │ 90.1%   │ │  4.2%   │ │  5.6%   │   │
│          │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│          │   (brand-subtle) (success bg)  (warning bg)  (error bg)
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐    │
│          │  │ Run Status Timeline                          │    │
│          │  │                                              │    │
│          │  │  30 ┤ ██                                     │    │
│          │  │     │ ██ ██                                   │    │
│          │  │  20 ┤ ██ ██ ██    ██                          │    │
│          │  │     │ ██ ██ ██ ██ ██ ██                       │    │
│          │  │  10 ┤ ██ ██ ██ ██ ██ ██ ██                    │    │
│          │  │     │ ░░ ░░ ░░ ░░ ░░ ░░ ░░                    │    │
│          │  │   0 ┼────────────────────                     │    │
│          │  │      Mon Tue Wed Thu Fri Sat Sun              │    │
│          │  │                                              │    │
│          │  │  ██ SUCCESS  ░░ WARNING  ▓▓ FAILED           │    │
│          │  └──────────────────────────────────────────────┘    │
│          │                                                      │
│          │  ┌────────────────────┐ ┌────────────────────────┐   │
│          │  │ Step Duration      │ │ Status by Dataset      │   │
│          │  │                    │ │                        │   │
│          │  │ l2r  ████░ 2.1s   │ │      ┌────┐           │   │
│          │  │ r2b  ██████░ 3.4s │ │    ╱ SUC  ╲          │   │
│          │  │ b2s  ████████ 5.1s│ │   │ 78%    │          │   │
│          │  │ s2g  ███░ 1.8s    │ │   │ WAR 12%│          │   │
│          │  │                    │ │    ╲ FAI 10╱          │   │
│          │  │ ██ avg  ░ p95     │ │      └────┘           │   │
│          │  └────────────────────┘ └────────────────────────┘   │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐    │
│          │  │ Recent Runs                           🔍 ▾   │    │
│          │  │                                              │    │
│          │  │  Step       Dataset       Status  Duration  TS│    │
│          │  │  ─────────────────────────────────────────────│    │
│          │  │  b2s        cbsenergie    ● OK    3.2s    06:05│   │
│          │  │  b2s        eponline      ● OK    2.8s    06:04│   │
│          │  │  l2r        rvosde        ◐ WARN  4.1s    06:03│   │
│          │  │  r2b        cbsenergie    ✕ FAIL  0.5s    06:02│   │
│          │  │  s2g        eponline      ● OK    1.9s    06:01│   │
│          │  │                                              │    │
│          │  │  ← 1  2  3  ... 12 →                        │    │
│          │  └──────────────────────────────────────────────┘    │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

### 4.2 Detail Drawer (click row)

```
                          ┌──────────────────────────────┐
                          │ ✕  Run Detail                │
                          │                              │
                          │  Step: bronze_to_silver      │
                          │  Dataset: cbsenergie         │
                          │  Status: ● SUCCESS           │
                          │  Duration: 3.2s              │
                          │  Timestamp: 2026-04-17       │
                          │             06:05:12 UTC     │
                          │  Run ID: abc-123-def         │
                          │  Environment: production     │
                          │                              │
                          │  ─── DQ Checks (this run) ── │
                          │  not_null_region  ● PASS     │
                          │  valid_energy     ● PASS     │
                          │  row_count_min    ◐ WARN     │
                          │                              │
                          │  ─── Parameters ────         │
                          │  scope: 2026-04              │
                          │  mode: incremental           │
                          │                              │
                          │  [View in Lineage →]         │
                          └──────────────────────────────┘
```

Drawer slides in from the right (desktop/tablet) or slides up from bottom (mobile).

---

## 5. DQ Control Center

### 5.1 Desktop (1440px)

```
┌──────────┬──────────────────────────────────────────────────────┐
│          │                                                      │
│ SIDEBAR  │  Data Quality Control                                │
│          │  Inspect check results across datasets and steps     │
│          │                                        [30d ▾] [ds ▾]│
│          │                                                      │
│          │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│          │  │ Pass %  │ │ Checks  │ │ High    │ │ Warnings│   │
│          │  │  92.3%  │ │  1,847  │ │    12   │ │    45   │   │
│          │  │ ↑ 0.8%  │ │ ↑ 120   │ │ ↓ 3    │ │ ↑ 5    │   │
│          │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│          │   (success bg) (brand-subtle)(error bg) (warning bg) │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐    │
│          │  │ DQ Pass Rate Trend                           │    │
│          │  │                                              │    │
│          │  │  100%┤                     ╱──               │    │
│          │  │   95%┤         ╱──────────╱                  │    │
│          │  │   90%┤────╱───╱ ─ ─ ─ ─ ─ ─ ─ ─ threshold  │    │
│          │  │   85%┤───╱                                   │    │
│          │  │   80%┤                                       │    │
│          │  │      └──────────────────────────             │    │
│          │  │       W1   W2   W3   W4                      │    │
│          │  └──────────────────────────────────────────────┘    │
│          │                                                      │
│          │  ┌────────────────────┐ ┌────────────────────────┐   │
│          │  │ Severity Heatmap   │ │ Category Breakdown     │   │
│          │  │                    │ │                        │   │
│          │  │       hi  med  lo  │ │ completeness ████████  │   │
│          │  │ l2r   🟢  🟡  🟢  │ │ accuracy     ██████    │   │
│          │  │ r2b   🟢  🟢  🟢  │ │ timeliness   ████      │   │
│          │  │ b2s   🔴  🟡  🟢  │ │ consistency  ███       │   │
│          │  │ s2g   🟢  🟢  🟡  │ │ uniqueness   ██        │   │
│          │  │                    │ │                        │   │
│          │  │ 🟢 pass  🟡 warn  │ │ ██ pass  ░░ fail      │   │
│          │  │ 🔴 fail            │ │                        │   │
│          │  └────────────────────┘ └────────────────────────┘   │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐    │
│          │  │ Check Results                    🔍   ▾ ▾ ▾  │    │
│          │  │                                              │    │
│          │  │  check_id           status sev    cat   step │    │
│          │  │  ────────────────────────────────────────────│    │
│          │  │  not_null_region    ● PASS high   compl  b2s │    │
│          │  │  valid_energy_cls   ● PASS high   accur  b2s │    │
│          │  │  row_count_min      ◐ WARN med    compl  r2b │    │
│          │  │  unique_cert_id     ✕ FAIL high   uniq   b2s │    │
│          │  │  format_postcode    ● PASS low    accur  b2s │    │
│          │  │                                              │    │
│          │  │  Filters: [status ▾] [severity ▾] [step ▾]  │    │
│          │  │  ← 1  2  3  ... 8 →                         │    │
│          │  └──────────────────────────────────────────────┘    │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

---

## 6. Lineage Explorer

### 6.1 Desktop (1440px) — Table-Level View

```
┌──────────┬──────────────────────────────────────────────────────┐
│          │                                                      │
│ SIDEBAR  │  Lineage Explorer         [Search entity...       ] │
│          │                           [● table  ○ column]       │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐    │
│          │  │                                              │    │
│          │  │  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │    │
│          │  │                                              │    │
│          │  │  │  ┌─────────────┐     ┌──────────────┐ │  │    │
│          │  │     │ 📄 landing  │     │ 📦 raw       │    │    │
│          │  │  │  │ cbsenergie  │────▶│ cbsenergie   │ │  │    │
│          │  │     │ .csv        │     │              │    │    │
│          │  │  │  └─────────────┘     └──────┬───────┘ │  │    │
│          │  │                                │            │    │
│          │  │  │                              ▼         │  │    │
│          │  │                         ┌──────────────┐    │    │
│          │  │  │                       │ 📦 bronze    │ │  │    │
│          │  │                         │ cbsenergie   │    │    │
│          │  │  │                       └──────┬───────┘ │  │    │
│          │  │                                │            │    │
│          │  │  │                              ▼         │  │    │
│          │  │                         ┌──────────────┐    │    │
│          │  │  │                       │ 📦 silver    │ │  │    │
│          │  │                         │ energielabel │    │    │
│          │  │  │                       └──────┬───────┘ │  │    │
│          │  │                                │            │    │
│          │  │  │                              ▼         │  │    │
│          │  │                         ┌──────────────┐    │    │
│          │  │  │                       │ 📦 gold      │ │  │    │
│          │  │                         │ dim_energy   │    │    │
│          │  │  │                       └──────────────┘ │  │    │
│          │  │                                              │    │
│          │  │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │    │
│          │  │                                              │    │
│          │  │   [🔍 zoom] [↔ fit] [⊞ columns] [📥 export] │    │
│          │  │   React Flow canvas — pan, zoom, fit         │    │
│          │  └──────────────────────────────────────────────┘    │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐    │
│          │  │ Entity Detail                            ✕   │    │
│          │  │                                              │    │
│          │  │  Entity: silver_energielabel                  │    │
│          │  │  Type: delta_table      Step: b2s            │    │
│          │  │  Columns: 16            Last seen: 2026-04-17│    │
│          │  │  Dataset: cbsenergie                          │    │
│          │  │                                              │    │
│          │  │  ─── Column Mappings ───                      │    │
│          │  │  target            source           type     │    │
│          │  │  ──────────────────────────────────────      │    │
│          │  │  region_code       RegionCode       DIRECT   │    │
│          │  │  energy_class      EnergyLabelClass DIRECT   │    │
│          │  │  build_year        Bouwjaar         DIRECT   │    │
│          │  │  label_date        LabelDatum       DERIVED  │    │
│          │  │  _meta_loaded_at   (system)         SYSTEM   │    │
│          │  └──────────────────────────────────────────────┘    │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

### 6.2 Desktop — Column-Level View (toggle "columns" on)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   ┌───────────────┐        ┌───────────────┐             │
│   │ 📦 bronze      │        │ 📦 silver      │            │
│   │ cbsenergie     │        │ energielabel   │            │
│   │ ──────────────│        │ ──────────────│            │
│   │ ∙ RegionCode  │───────▶│ ∙ region_code │            │
│   │ ∙ EnergyLabel │───────▶│ ∙ energy_class│            │
│   │ ∙ Bouwjaar    │───────▶│ ∙ build_year  │            │
│   │ ∙ LabelDatum  │──┐     │ ∙ label_date  │            │
│   │ ∙ Postcode    │  │    ▶│ ∙ postal_area │            │
│   │ ∙ _meta_*     │  │     │ ∙ _meta_*     │            │
│   └───────────────┘  │     └───────────────┘             │
│                      │                                    │
│                      └─── DERIVED (date format applied)   │
│                                                          │
│   Click a column → highlights its lineage path in        │
│   accent color (#C8892A), dims unrelated paths           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 6.3 Entity Node Anatomy

```
┌─────────────────────────────┐
│ 📦  silver_energielabel     │  ← header: icon + name
│     delta_table             │  ← subtitle: entity type
├─────────────────────────────┤
│ ∙ region_code    VARCHAR    │  ← column: dot + name + type
│ ∙ energy_class   VARCHAR    │
│ ∙ build_year     INTEGER    │
│ ∙ label_date     DATE       │
│ ∙ postal_area    VARCHAR    │
│   + 11 more columns         │  ← expandable
├─────────────────────────────┤
│ Step: b2s  │ 16 columns     │  ← footer: metadata
└─────────────────────────────┘

States:
- Default: --surface bg, --border border
- Hover:   --shadow-hover
- Selected: --brand-subtle bg, --brand border (2px)
- Column highlighted: column row gets --accent-subtle bg
```

### 6.4 Mobile — Lineage

```
┌──────────────────────────────────────┐
│ LOGO               [🔍] [⊞]  ☰      │
├──────────────────────────────────────┤
│                                      │
│  ┌──────────────────────────────┐    │
│  │                              │    │
│  │   Full-screen React Flow     │    │
│  │   canvas                     │    │
│  │                              │    │
│  │   Touch: pinch-zoom, drag    │    │
│  │                              │    │
│  │   ┌──────┐    ┌──────┐      │    │
│  │   │bronze│───▶│silver│      │    │
│  │   └──────┘    └──────┘      │    │
│  │                              │    │
│  │  ┌──────────────────────┐   │    │
│  │  │ [🔍] [↔] [⊞] [📥]   │   │    │  ← floating toolbar
│  │  └──────────────────────┘   │    │
│  │                              │    │
│  └──────────────────────────────┘    │
│                                      │
│  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔     │  ← swipe up handle
│  Entity Detail (bottom sheet)        │
│  silver_energielabel                 │
│  delta_table | 16 columns            │
│  [Expand ↑]                          │
│                                      │
├──────────────────────────────────────┤
│  Home   Pipe   Qual   Lin.   Dash   │
└──────────────────────────────────────┘
```

---

## 7. OpenLineage Viewer

### 7.1 Desktop (1440px)

```
┌──────────┬──────────────────────────────────────────────────────┐
│          │                                                      │
│ SIDEBAR  │  OpenLineage Events                                  │
│          │  Browse raw OpenLineage RunEvents                    │
│          │                                          [7d ▾][job▾]│
│          │                                                      │
│          │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│          │  │ Events  │ │ Jobs    │ │ Inputs  │ │ Outputs │   │
│          │  │    86   │ │     4   │ │    12   │ │     8   │   │
│          │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐    │
│          │  │ RunEvent Timeline                            │    │
│          │  │                                              │    │
│          │  │ ┌──────────────────────────────────────────┐ │    │
│          │  │ │ ● COMPLETE   bronze_to_silver            │ │    │
│          │  │ │   2026-04-17T06:05:00Z                   │ │    │
│          │  │ │   Inputs: 1   Outputs: 1   Facets: 3    │ │    │
│          │  │ │   ┌ dataQualityMetrics ┐ ┌ columnLin ┐  │ │    │
│          │  │ │   └───────────────────┘ └──────────┘    │ │    │
│          │  │ └──────────────────────────────────────────┘ │    │
│          │  │                                              │    │
│          │  │ ┌──────────────────────────────────────────┐ │    │
│          │  │ │ ● COMPLETE   landing_to_raw              │ │    │
│          │  │ │   2026-04-17T06:02:00Z                   │ │    │
│          │  │ │   Inputs: 1   Outputs: 1   Facets: 2    │ │    │
│          │  │ └──────────────────────────────────────────┘ │    │
│          │  │                                              │    │
│          │  │ ┌──────────────────────────────────────────┐ │    │
│          │  │ │ ▶ START      raw_to_bronze               │ │    │
│          │  │ │   2026-04-17T06:03:00Z                   │ │    │
│          │  │ │   Inputs: 1   Outputs: 0   Facets: 1    │ │    │
│          │  │ └──────────────────────────────────────────┘ │    │
│          │  │                                              │    │
│          │  │  ← 1  2  3 →                                │    │
│          │  └──────────────────────────────────────────────┘    │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

### 7.2 Expanded RunEvent Detail

```
┌──────────────────────────────────────────────────┐
│ ● COMPLETE   bronze_to_silver              [▼]   │
│   2026-04-17T06:05:00Z                           │
│                                                  │
│   ─── Run ───                                    │
│   runId: 3fa85f64-5717-4562-b3fc-2c963f66afa6   │
│   facets:                                        │
│     processing_engine:                           │
│       version: "14.3"                            │
│       name: "spark"                              │
│                                                  │
│   ─── Job ───                                    │
│   namespace: esg_demo                            │
│   name: bronze_to_silver                         │
│                                                  │
│   ─── Inputs ───                                 │
│   ┌────────────────────────────────────────┐     │
│   │ 📥 esg_demo.bronze_cbsenergie          │     │
│   │    facets: schema (16 fields)          │     │
│   └────────────────────────────────────────┘     │
│                                                  │
│   ─── Outputs ───                                │
│   ┌────────────────────────────────────────┐     │
│   │ 📤 esg_demo.silver_energielabel        │     │
│   │    facets: schema, columnLineage       │     │
│   │    ┌ columnLineage ──────────────────┐ │     │
│   │    │ region_code ← RegionCode        │ │     │
│   │    │ energy_class ← EnergyLabelClass │ │     │
│   │    └─────────────────────────────────┘ │     │
│   └────────────────────────────────────────┘     │
│                                                  │
│   ─── Raw JSON ───                               │
│   ┌────────────────────────────────────────┐     │
│   │ ▶ { "eventType": "COMPLETE", ...}      │     │ ← collapsible
│   │   ▶ "run": { ... }                    │     │   JSON tree
│   │   ▶ "job": { ... }                    │     │
│   │   ▼ "inputs": [                       │     │
│   │       { "namespace": "esg_demo",      │     │
│   │         "name": "bronze_cbsenergie",  │     │
│   │         ▶ "facets": { ... }           │     │
│   │       }                               │     │
│   │     ]                                 │     │
│   │   ▶ "outputs": [ ... ]               │     │
│   └────────────────────────────────────────┘     │
│                                                  │
│   [Copy JSON]  [View in Lineage →]               │
└──────────────────────────────────────────────────┘
```

### 7.3 Facet Badges

```
┌──────────────────────┐  ┌──────────────────────┐
│ 📊 dataQualityMetrics│  │ 🔗 columnLineage     │
│     (brand-subtle)   │  │     (accent-subtle)  │
└──────────────────────┘  └──────────────────────┘
┌──────────────────────┐  ┌──────────────────────┐
│ 📋 schema            │  │ ⚙️ processing_engine  │
│     (surface-alt)    │  │     (surface-alt)    │
└──────────────────────┘  └──────────────────────┘
```

---

## 8. BCBS239 Scorecard

### 8.1 Desktop (1440px)

```
┌──────────┬──────────────────────────────────────────────────────┐
│          │                                                      │
│ SIDEBAR  │  BCBS239 Compliance Scorecard                        │
│          │  Regulatory data quality principles                  │
│          │                                              [30d ▾] │
│          │                                                      │
│          │  Overall Score                                        │
│          │  ┌──────────────────────────────────────────────┐    │
│          │  │          87%                                  │    │
│          │  │  ████████████████████████████░░░░░            │    │
│          │  │  ↑ 2% vs previous period                     │    │
│          │  └──────────────────────────────────────────────┘    │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐    │
│          │  │ Principle                Score    Status      │    │
│          │  │ ──────────────────────────────────────────── │    │
│          │  │ P1  Governance            92%     ● Good     │    │
│          │  │ P2  Data Architecture     88%     ● Good     │    │
│          │  │ P3  Accuracy              95%     ● Good     │    │
│          │  │ P4  Completeness          82%     ◐ Review   │    │
│          │  │ P5  Timeliness            78%     ◐ Review   │    │
│          │  │ P6  Adaptability          91%     ● Good     │    │
│          │  │                                              │    │
│          │  │  Score thresholds:                            │    │
│          │  │  ● Good (≥85%)  ◐ Review (70–84%)            │    │
│          │  │  ○ Action (<70%)                              │    │
│          │  │                                              │    │
│          │  │  Click row → evidence detail                  │    │
│          │  └──────────────────────────────────────────────┘    │
│          │                                                      │
│          │  ┌────────────────────┐ ┌────────────────────────┐   │
│          │  │ Score Trend        │ │ Evidence Coverage      │   │
│          │  │                    │ │                        │   │
│          │  │  90%┤     ╱──      │ │ P1  ████████████  12  │   │
│          │  │  85%┤ ───╱         │ │ P2  ██████████    10  │   │
│          │  │  80%┤╱             │ │ P3  ████████████  12  │   │
│          │  │     └──────────    │ │ P4  ██████         6  │   │
│          │  │      M  A  M  J   │ │ P5  ████           4  │   │
│          │  │                    │ │ P6  ██████████    10  │   │
│          │  └────────────────────┘ └────────────────────────┘   │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

### 8.2 Principle Evidence Detail (click row)

```
┌──────────────────────────────────────────────────┐
│ ✕  P3 — Accuracy                          92%    │
│                                                  │
│  Evidence items:                                 │
│  ┌──────────────────────────────────────────┐    │
│  │ ✓  DQ checks with accuracy category      │    │
│  │    pass rate: 95.2%                       │    │
│  │    Source: data_quality_checks            │    │
│  │    Checks: 24 pass / 1 warn / 0 fail     │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │ ✓  Column lineage completeness            │    │
│  │    coverage: 94.1%                        │    │
│  │    Source: data_lineage                   │    │
│  │    Mapped: 128 / 136 columns              │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │ ◐  Data freshness validation              │    │
│  │    last run: 2h ago (threshold: 6h)       │    │
│  │    Source: pipeline_runs                  │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  [Download Evidence Report (PDF) →]              │
└──────────────────────────────────────────────────┘
```

---

## 9. Dashboard Builder

### 9.1 Dashboard List View

```
┌──────────┬──────────────────────────────────────────────────────┐
│          │                                                      │
│ SIDEBAR  │  My Dashboards                       [+ New Dashboard]
│          │                                                      │
│          │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│          │  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │           │
│          │  │ │░░░░░░│ │  │ │░░░░░░│ │  │ │░░░░░░│ │           │
│          │  │ │░░░░░░│ │  │ │░░░░░░│ │  │ │░░░░░░│ │           │
│          │  │ │░░░░░░│ │  │ │░░░░░░│ │  │ │░░░░░░│ │           │
│          │  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │           │
│          │  │          │  │          │  │          │           │
│          │  │ Ops      │  │ Weekly   │  │ Mgmt    │           │
│          │  │ Report   │  │ DQ       │  │ Review  │           │
│          │  │ Updated  │  │ Updated  │  │ Updated │           │
│          │  │ 2h ago   │  │ 1d ago   │  │ 3d ago  │           │
│          │  │ [⋯]      │  │ [⋯]      │  │ [⋯]     │           │
│          │  └──────────┘  └──────────┘  └──────────┘           │
│          │                                                      │
│          │  ┌ ─ ─ ─ ─ ─ ┐                                      │
│          │  │            │                                      │
│          │  │  + Create  │                                      │
│          │  │  Dashboard │                                      │
│          │  │            │                                      │
│          │  └ ─ ─ ─ ─ ─ ┘                                      │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

### 9.2 Dashboard Edit Mode

```
┌──────────┬──────────────────────────────────────┬───────────────┐
│          │                                      │               │
│ SIDEBAR  │  Ops Report          [Save] [Cancel] │ Widget Palette│
│          │  ──────────────────────────────────── │               │
│          │                                      │ ┌───────────┐ │
│          │  Date range: [Last 7 days ▾]         │ │ Counter   │ │
│          │                                      │ │   42      │ │
│          │  ┌──────────┐ ┌──────────┐           │ └───────────┘ │
│          │  │ ┌──────┐ │ │ ┌──────┐ │           │ ┌───────────┐ │
│          │  │ │  42  │ │ │ │ 93%  │ │           │ │ Bar Chart │ │
│          │  │ │ Runs │ │ │ │ DQ % │ │           │ │  ██ ██ ██ │ │
│          │  │ └──────┘ │ │ └──────┘ │ ← resize  │ └───────────┘ │
│          │  │  ···     │ │  ···     │   handles  │ ┌───────────┐ │
│          │  └──────────┘ └──────────┘           │ │ Line Chart│ │
│          │  ┌────────────────────────┐           │ │  ╱╲╱╲    │ │
│          │  │ ┌──────────────────┐   │           │ └───────────┘ │
│          │  │ │  ██ █ ██ █ ██   │   │           │ ┌───────────┐ │
│          │  │ │  Runs by Step   │   │           │ │ Area Chart│ │
│          │  │ │  (Bar Chart)    │   │           │ │  ▓▓▓▓▓    │ │
│          │  │ └──────────────────┘   │           │ └───────────┘ │
│          │  │  ···                    │           │ ┌───────────┐ │
│          │  └────────────────────────┘           │ │ Donut     │ │
│          │                                      │ │  ◉        │ │
│          │  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐           │ └───────────┘ │
│          │  │                        │           │ ┌───────────┐ │
│          │  │  Drop widget here      │           │ │ Table     │ │
│          │  │                        │           │ │ ═══════   │ │
│          │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘           │ └───────────┘ │
│          │                                      │ ┌───────────┐ │
│          │                                      │ │ Metric    │ │
│          │                                      │ │  42 ╱╲   │ │
│          │                                      │ └───────────┘ │
│          │                                      │ ┌───────────┐ │
│          │                                      │ │ Heatmap   │ │
│          │                                      │ │ ▓░▓░▓     │ │
│          │                                      │ └───────────┘ │
│          │                                      │ ┌───────────┐ │
│          │                                      │ │ Status    │ │
│          │                                      │ │ List      │ │
│          │                                      │ │ ● ● ◐    │ │
│          │                                      │ └───────────┘ │
│          │                                      │               │
└──────────┴──────────────────────────────────────┴───────────────┘
```

### 9.3 Widget Config Panel (on select widget)

```
┌──────────────────────────────────────┐
│ Widget Configuration             ✕   │
│                                      │
│ Title                                │
│ ┌──────────────────────────────────┐ │
│ │ Pipeline Runs                    │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Data source                          │
│ ┌──────────────────────────────────┐ │
│ │ pipeline_runs                  ▾ │ │
│ └──────────────────────────────────┘ │
│   Options: pipeline_runs             │
│            data_quality_checks       │
│            data_lineage              │
│                                      │
│ Aggregation                          │
│ ┌──────────────────────────────────┐ │
│ │ count                          ▾ │ │
│ └──────────────────────────────────┘ │
│   Options: count | sum | avg |       │
│            min | max | distinct_count│
│                                      │
│ Group by                             │
│ ┌──────────────────────────────────┐ │
│ │ step                           ▾ │ │
│ └──────────────────────────────────┘ │
│   Options: step | dataset_id |       │
│     run_status | check_status |      │
│     check_category | event_date |    │
│     source_entity | target_entity    │
│                                      │
│ Filter                               │
│ ┌──────────┐ ┌──────┐ ┌───────────┐ │
│ │ step   ▾ │ │ =  ▾ │ │ b2s       │ │
│ └──────────┘ └──────┘ └───────────┘ │
│ [+ Add filter]                       │
│                                      │
│ Date range                           │
│ ┌──────────────────────────────────┐ │
│ │ Inherit from dashboard         ▾ │ │
│ └──────────────────────────────────┘ │
│   Options: inherit | custom          │
│                                      │
│ Size                                 │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐         │
│ │ 1×1│ │ 2×1│ │ 3×1│ │ 2×2│         │
│ └────┘ └────┘ └────┘ └────┘         │
│ ┌────┐ ┌────┐ ┌────┐                │
│ │ 3×2│ │ 6×1│ │ 6×2│                │
│ └────┘ └────┘ └────┘                │
│                                      │
│ [Apply]              [Remove Widget] │
└──────────────────────────────────────┘
```

### 9.4 Widget Shell (rendered widget container)

```
┌──────────────────────────────────────┐
│ Pipeline Runs              [⋯]  [⤡] │  ← title bar
├──────────────────────────────────────┤     [⋯] = menu (edit, duplicate, delete)
│                                      │     [⤡] = resize handle
│  (chart / counter / table content)   │
│                                      │
│                                      │
└──────────────────────────────────────┘

States:
- Default:   --surface bg, --border border, --shadow-card
- Hover:     --shadow-hover, dotted border
- Selected:  --brand border (2px), config panel opens
- Dragging:  --shadow-dropdown, slight rotation (2deg)
```

### 9.5 Grid System

- 6-column grid for desktop
- 4-column grid for tablet
- 2-column grid for mobile
- Column gap: 16px
- Row gap: 16px
- Widget sizes (columns × rows): 1×1, 2×1, 3×1, 2×2, 3×2, 6×1, 6×2

---

## 10. Notification Mini Widgets

### 10.1 Desktop — Top-right of content area

```
                              ┌────────────────────────────────┐
                              │ 🔴  3 pipeline failures today  │
                              │ 🟡  DQ pass rate dropped < 90% │
                              │ 🟢  All lineage coverage OK    │
                              │                        [Dismiss]│
                              └────────────────────────────────┘
```

- Position: fixed top-right of content area (not sidebar)
- Auto-generated from latest `pipeline_runs` and `data_quality_checks`
- Visual only — no external notification system
- Dismissible per session
- Max 5 items visible, overflow scrolls

### 10.2 Mobile — Dismissible banner

```
┌──────────────────────────────────────┐
│ 🔴 3 failures today             ✕   │  ← swipe to dismiss
└──────────────────────────────────────┘
```

- Stacks below TopBar
- One banner at a time, auto-cycles
- Tap → navigates to relevant view

---

## 11. Component Inventory

### 11.1 Layout Components

| Component       | Variants                                      | Responsive Behavior                          |
| --------------- | --------------------------------------------- | -------------------------------------------- |
| `AppShell`      | sidebar + content                             | Sidebar hidden on mobile, BottomNav appears  |
| `Sidebar`       | expanded (260px), collapsed (64px)            | Always collapsed on tablet, hidden on mobile |
| `BottomNav`     | 5 items                                       | Mobile only, with safe area inset            |
| `TopBar`        | logo + notifications + hamburger              | Mobile only                                  |
| `PageHeader`    | title + subtitle + filters + actions          | Filters wrap below title on mobile           |
| `ContentGrid`   | responsive CSS grid                           | 3-col → 2-col → 1-col                       |

### 11.2 Data Display Components

| Component        | Variants / Props                                              |
| ---------------- | ------------------------------------------------------------- |
| `CounterCard`    | `value`, `label`, `trend` (↑/↓/→), `icon`, `bgColor`         |
| `DataTable`      | sortable columns, filterable, paginated, click-to-detail      |
| `DetailDrawer`   | side (desktop) / bottom sheet (mobile), closeable             |
| `MetricCard`     | `value`, `label`, `sparklineData`, `changePercent`            |
| `StatusBadge`    | `SUCCESS` (green), `WARNING` (amber), `FAILED` (red)         |
| `EmptyState`     | illustration + message + optional CTA                         |
| `LoadingState`   | skeleton cards, skeleton table rows, shimmer animation        |

#### CounterCard Anatomy

```
┌───────────────────────────┐
│  ◉                  ↑ 8% │  ← icon (Lucide, 20px)  +  trend
│                           │
│         142               │  ← value (Fraunces 700, 36px)
│    Pipeline Runs          │  ← label (Inter 400, 13px, --text-muted)
└───────────────────────────┘
   Surface: --surface bg
   Border: --border
   Radius: 16px
   Shadow: --shadow-card
   Trend up: --success
   Trend down: --error
   Trend neutral: --text-subtle
```

#### StatusBadge Variants

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ ● SUCCESS│  │ ◐ WARNING│  │ ✕ FAILED │
│  (green) │  │ (amber)  │  │  (red)   │
└──────────┘  └──────────┘  └──────────┘
  bg: success/10   bg: warning/10   bg: error/10
  text: success    text: warning    text: error
  radius: 8px      radius: 8px      radius: 8px
  font: Inter 500, 11px
```

### 11.3 Chart Components

| Component      | Props / Config                                                  |
| -------------- | --------------------------------------------------------------- |
| `BarChart`     | vertical/horizontal, grouped/stacked, `data`, `xKey`, `yKey`   |
| `LineChart`    | time series, multi-line, `data`, `lines[]`, threshold line      |
| `AreaChart`    | filled, stacked or single, `data`, `areas[]`                   |
| `DonutChart`   | center label (total or percentage), `data`, `segments[]`        |
| `HeatmapGrid` | step × severity, step × date, color scale, `rows`, `cols`      |
| `Sparkline`    | inline mini chart, no axes, `data`, `width`, `height`           |

Chart color mapping:
- SUCCESS: `--success` (#10B981)
- WARNING: `--warning` (#F59E0B)
- FAILED: `--error` (#EF4444)
- Primary series: `--brand` (#1B3B6B)
- Secondary series: `--brand-light` (#4B7BB5)
- Tertiary series: `--accent` (#C8892A)
- Threshold line: dashed, `--text-subtle`

### 11.4 Lineage Components

| Component          | Props / Behavior                                                |
| ------------------ | --------------------------------------------------------------- |
| `LineageCanvas`    | React Flow wrapper, pan/zoom/fit, minimap optional              |
| `EntityNode`       | header (name + icon), column list (expandable), footer (meta)   |
| `ColumnNode`       | column name + data type, highlight state                        |
| `LineageEdge`      | arrow with optional step label, animated on hover               |
| `EntityDetailPanel`| entity metadata + column mappings table                         |
| `LineageToolbar`   | zoom in/out, fit view, toggle columns, search, export           |

#### EntityNode States

| State             | Visual                                                    |
| ----------------- | --------------------------------------------------------- |
| Default           | `--surface` bg, `--border` border, `--shadow-card`        |
| Hover             | `--shadow-hover`                                          |
| Selected          | `--brand-subtle` bg, `--brand` border (2px)               |
| Column highlight  | Column row gets `--accent-subtle` bg                      |
| Dimmed            | 40% opacity (when another path is highlighted)            |

### 11.5 Dashboard Builder Components

| Component          | Props / Behavior                                               |
| ------------------ | -------------------------------------------------------------- |
| `DashboardGrid`    | drag & drop, 6-col grid, snap-to-grid, resize handles         |
| `WidgetPalette`    | right drawer, draggable widget type cards                      |
| `WidgetConfigPanel`| form: title, data source, aggregation, group by, filter, size  |
| `WidgetShell`      | title bar + actions (edit, duplicate, delete) + resize handle  |
| `DashboardCard`    | thumbnail preview + title + updated timestamp + menu           |

### 11.6 OpenLineage Components

| Component        | Props / Behavior                                                |
| ---------------- | --------------------------------------------------------------- |
| `RunEventCard`   | expandable summary: event type + job name + timestamp + counts  |
| `JsonTreeViewer` | collapsible JSON display, syntax highlighted, copy button       |
| `FacetBadge`     | facet type label, colored background per type                   |
| `DatasetCard`    | namespace + name + facet list, input (📥) / output (📤) icon   |

### 11.7 Input & Control Components

| Component         | Variants / Props                                                |
| ----------------- | --------------------------------------------------------------- |
| `DateRangePicker` | preset buttons (7d, 30d, 90d, custom) + calendar popover       |
| `FilterDropdown`  | single select / multi select, search within, clear button       |
| `SearchInput`     | 300ms debounce, Lucide search icon, clear button                |
| `ToggleGroup`     | segmented control (2–4 options), pill-shaped segments           |
| `IconButton`      | Lucide icon, tooltip, size: sm (32px) / md (40px) / lg (48px)  |

#### DateRangePicker

```
┌──────────────────────────────────────┐
│ [7d] [30d] [90d] [Custom ▾]         │
│                                      │
│ Custom:                              │
│ ┌────────────┐  ┌────────────┐      │
│ │ 2026-03-18 │  │ 2026-04-17 │      │
│ │ Start date │  │ End date   │      │
│ └────────────┘  └────────────┘      │
│                                      │
│ ┌──────────────────────────────┐    │
│ │      April 2026              │    │
│ │ Mo Tu We Th Fr Sa Su         │    │
│ │        1  2  3  4  5         │    │
│ │  6  7  8  9 10 11 12         │    │
│ │ 13 14 15 16 [17] ← selected │    │
│ │ 20 21 22 23 24 25 26         │    │
│ │ 27 28 29 30                  │    │
│ └──────────────────────────────┘    │
│                          [Apply]     │
└──────────────────────────────────────┘
```

### 11.8 Feedback Components

| Component         | Variants / Behavior                                            |
| ----------------- | -------------------------------------------------------------- |
| `NotificationBanner` | dismissible, severity-colored left border, icon + message   |
| `Toast`           | bottom-right (desktop), bottom-center (mobile), auto-dismiss 5s|
| `ConfirmDialog`   | title + message + cancel (ghost) + confirm (destructive/primary)|

#### ConfirmDialog

```
┌──────────────────────────────────────┐
│                                      │
│  Delete Dashboard?                   │
│                                      │
│  "Ops Report" will be permanently    │
│  deleted. This action cannot be      │
│  undone.                             │
│                                      │
│            [Cancel]  [Delete]        │
│             ghost    destructive     │
│                      (--error bg)    │
└──────────────────────────────────────┘
```

### 11.9 Shared Components

| Component       | Variants / Props                                              |
| --------------- | ------------------------------------------------------------- |
| `DarkModeToggle`| switch with sun/moon icons, persists to localStorage          |
| `BreadcrumbNav` | path segments as links, current segment as text               |
| `UserAvatar`    | 32px circle, initials fallback, dropdown menu                 |
| `Logo`          | mark (icon only, 32px) / wordmark (icon + "Latero", 120px)  |

---

## 12. Interaction Patterns

### 12.1 Navigation

| Action                        | Desktop                           | Mobile                       |
| ----------------------------- | --------------------------------- | ---------------------------- |
| Navigate to page              | Click sidebar item                | Tap bottom nav or hamburger  |
| Collapse sidebar              | Click chevron toggle              | N/A (always collapsed)       |
| Return to previous page       | Breadcrumb or browser back        | System back gesture          |

### 12.2 Data Interaction

| Action                        | Desktop                           | Mobile                       |
| ----------------------------- | --------------------------------- | ---------------------------- |
| View detail                   | Click table row → right drawer    | Tap row → bottom sheet       |
| Sort table                    | Click column header               | Tap column header            |
| Filter data                   | FilterDropdown in PageHeader      | Filter icon → full-screen    |
| Change date range             | DateRangePicker in PageHeader     | DateRangePicker full-width   |
| Search                        | SearchInput in PageHeader         | Search icon → expanding bar  |

### 12.3 Lineage Interaction

| Action                        | Desktop                           | Mobile                       |
| ----------------------------- | --------------------------------- | ---------------------------- |
| Pan graph                     | Click + drag canvas               | Single-finger drag           |
| Zoom                          | Scroll wheel or toolbar buttons   | Pinch-to-zoom                |
| Select entity                 | Click node                        | Tap node                     |
| View entity detail            | Detail panel below canvas         | Bottom sheet (swipe up)      |
| Highlight column lineage      | Click column in node              | Tap column in node           |
| Fit view                      | Toolbar "fit" button              | Toolbar "fit" button         |

### 12.4 Dashboard Builder Interaction

| Action                        | Desktop                           | Mobile                       |
| ----------------------------- | --------------------------------- | ---------------------------- |
| Add widget                    | Drag from palette to grid         | Tap widget type → auto-place |
| Move widget                   | Drag widget by title bar          | Long-press + drag            |
| Resize widget                 | Drag resize handle                | Not supported (preset sizes) |
| Configure widget              | Click widget → config panel       | Tap widget → full-screen form|
| Delete widget                 | Widget menu → Delete → Confirm    | Widget menu → Delete → Confirm|
| Save dashboard                | Save button in header             | Save button in header        |

---

## 13. Accessibility

| Requirement                   | Implementation                                            |
| ----------------------------- | --------------------------------------------------------- |
| Color contrast                | All text meets WCAG 2.1 AA (4.5:1 body, 3:1 large)       |
| Keyboard navigation           | All interactive elements focusable, visible focus ring    |
| Focus ring                    | 2px solid `--brand`, 2px offset                           |
| Screen reader                 | ARIA labels on icons, roles on landmarks, live regions    |
| Reduced motion                | `prefers-reduced-motion`: disable animations, transitions |
| Touch targets                 | Minimum 44×44px on all interactive elements               |
| Chart accessibility           | Alt text descriptions, data table fallback option         |
| Status communication          | Status badges use icon + text (not color alone)           |

---

## 14. Loading & Empty States

### 14.1 Loading — Skeleton

```
┌─────────────────────────────┐
│ ░░░░░░░░░░░░                │  ← shimmer animation
│                             │     left-to-right
│ ░░░░░░░░░░░░░░░░░░░         │     1.5s duration
│ ░░░░░░░░░░░░░░              │     ease-in-out
│ ░░░░░░░░░░░░░░░░            │
└─────────────────────────────┘
  Skeleton color: --surface-alt
  Shimmer: linear-gradient overlay
```

### 14.2 Empty State

```
┌─────────────────────────────┐
│                             │
│        ┌──────┐             │
│        │  📊  │             │  ← illustration (64px)
│        └──────┘             │
│                             │
│    No pipeline runs yet     │  ← heading (Inter 600, 16px)
│                             │
│  Pipeline runs will appear  │  ← description (Inter 400, 14px,
│  here once your first       │     --text-muted)
│  pipeline completes.        │
│                             │
│    [Go to Settings →]       │  ← optional CTA (brand button)
│                             │
└─────────────────────────────┘
```

### 14.3 Error State

```
┌─────────────────────────────┐
│                             │
│        ┌──────┐             │
│        │  ⚠️  │             │
│        └──────┘             │
│                             │
│   Something went wrong      │
│                             │
│  We couldn't load your data │
│  Please try again.          │
│                             │
│      [Retry]                │
│                             │
└─────────────────────────────┘
```

---

## 15. Responsive Breakpoints Summary

| Breakpoint   | Width          | Layout Changes                                |
| ------------ | -------------- | --------------------------------------------- |
| Desktop XL   | ≥1440px        | Full layout, 3-col content grids              |
| Desktop      | 1024–1439px    | Full layout, 2-col content grids              |
| Tablet       | 768–1023px     | Collapsed sidebar, 2-col → 1-col grids        |
| Mobile       | <768px         | No sidebar, TopBar + BottomNav, 1-col stacked |
| Mobile small | <375px         | Tighter spacing, smaller counter values        |

---

## 16. Dark Mode Behavior

- Toggle in sidebar footer (desktop) or hamburger menu (mobile)
- Persisted to `localStorage`
- Applied via `data-theme="dark"` on `<html>`
- All color tokens swap per dark palette (Section 1.1)
- Charts: darker grid lines, lighter data colors
- Shadows: reduced opacity in dark mode
- Images/illustrations: inverted or alternate dark variants
- System preference detection: `prefers-color-scheme: dark` as default

---

## 17. Page-by-Page URL Structure

| Page                  | Route                        |
| --------------------- | ---------------------------- |
| Home                  | `/`                          |
| Pipeline Health       | `/pipelines`                 |
| DQ Control Center     | `/quality`                   |
| Lineage Explorer      | `/lineage`                   |
| OpenLineage Viewer    | `/openlineage`               |
| BCBS239 Scorecard     | `/bcbs239`                   |
| Dashboard List        | `/dashboards`                |
| Dashboard View        | `/dashboards/:id`            |
| Dashboard Edit        | `/dashboards/:id/edit`       |
| Settings              | `/settings`                  |
