"use client";

import { PageHeader } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  Activity,
  ArrowRight,
  BarChart2,
  Database,
  ExternalLink,
  GitBranch,
  Info,
  Layers3,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
  Building2,
  Users,
  KeyRound,
  ShieldAlert,
} from "lucide-react";

const VALUE_PILLARS = [
  {
    icon: Activity,
    title: "Observe",
    body: "Track pipeline runs, quality signals and metadata health in one operational workspace.",
  },
  {
    icon: Search,
    title: "Investigate",
    body: "Move from a failing KPI to a dataset, lineage path or run event without leaving the product.",
  },
  {
    icon: ShieldCheck,
    title: "Govern",
    body: "Use the same evidence for controls, stewardship and audit conversations instead of separate spreadsheets.",
  },
];

const PRODUCT_FLOWS = [
  {
    icon: BarChart2,
    title: "Operational dashboards",
    body:
      "System dashboards for pipelines, data quality and BCBS 239 surface the current state first, with drill-down where users need evidence.",
    bullets: [
      "Prebuilt dashboards with resettable defaults",
      "Reusable widgets and custom layouts",
      "KPI, chart and table views for daily monitoring",
    ],
  },
  {
    icon: GitBranch,
    title: "Lineage exploration",
    body:
      "The lineage experience supports different investigation modes instead of forcing one graph to do everything.",
    bullets: [
      "Graph view for structure and impact",
      "Chains view for end-to-end flow context",
      "Columns view for attribute-level mappings",
    ],
  },
  {
    icon: Database,
    title: "Dataset health",
    body:
      "The Dataset Health page combines execution status, quality outcomes and lineage reach at dataset level.",
    bullets: [
      "Latest run and processing step",
      "DQ pass, warning and fail breakdowns",
      "Lineage reach as impact context",
    ],
  },
];

const META_TABLES = [
  {
    icon: Database,
    name: "pipeline_runs",
    desc: "Execution events with timing, step, status and run context.",
  },
  {
    icon: ShieldCheck,
    name: "data_quality_checks",
    desc: "Control outcomes and evidence captured per run.",
  },
  {
    icon: GitBranch,
    name: "data_lineage",
    desc: "Entity and column lineage evidence used across lineage and OpenLineage views.",
  },
];

const OPERATING_MODEL = [
  {
    icon: Layers3,
    title: "One metadata backbone",
    text:
      "Every specialist view reads from the same metadata foundation, so summaries and drilldowns stay aligned with the runtime that produced the events.",
  },
  {
    icon: Workflow,
    title: "From issue to explanation",
    text:
      "Users can move from a red KPI to the affected dataset, then into lineage structure or OpenLineage event detail without switching tools.",
  },
  {
    icon: Radar,
    title: "Built for operations and stewardship",
    text:
      "The product supports both operational monitoring and evidence-oriented conversations for stewardship and governance teams.",
  },
];

const MULTI_TENANT_UX_PRINCIPLES = [
  {
    icon: Building2,
    title: "Tenant context first",
    text: "Every operational view should make the active installation explicit, so users always know which tenant context they are working in.",
  },
  {
    icon: Users,
    title: "Role-segregated controls",
    text: "Tenant users focus on monitoring and analysis, while platform admins own tenant lifecycle, access and key management in Admin Center.",
  },
  {
    icon: KeyRound,
    title: "Governance in one place",
    text: "Password resets, user rights, installation provisioning and API key lifecycle are grouped in admin flows to avoid fragmented security operations.",
  },
  {
    icon: ShieldAlert,
    title: "Auditability by design",
    text: "Critical actions should be traceable from one admin timeline so teams can explain who changed what and when across tenants.",
  },
];

export function AboutDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader title="About" icon={Info} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
              What this product is for
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text)" }}>
              Latero Control helps teams answer four operational questions quickly: what happened, what changed, what is impacted, and what evidence supports that answer.
            </p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {VALUE_PILLARS.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-xl p-4 space-y-2"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Icon className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
                    <Badge variant="default">{title}</Badge>
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{body}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
              Typical user journey
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <JourneyStep
              title="Start with overview"
              text="Use the system dashboards to identify red signals, anomalies or a dataset that needs attention."
            />
            <JourneyStep
              title="Open the affected dataset"
              text="Check latest run state, quality outcomes and recent lineage evidence in one place."
            />
            <JourneyStep
              title="Drill into lineage or run detail"
              text="Use Lineage Explorer or OpenLineage when the summary is not enough and you need explanation."
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {PRODUCT_FLOWS.map(({ icon: Icon, title, body, bullets }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                {body}
              </p>
              <ul className="space-y-2">
                {bullets.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--color-accent)" }} />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
            Technical foundation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            All data lands in a single Postgres read store, regardless of how it arrived. Runtimes can push events via the API ingest endpoints, or operators can trigger a pull sync from Databricks. Either way, the dashboard layer reads from the same canonical store — keeping operational views, lineage and quality aligned.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div
              className="rounded-xl p-4 space-y-1.5"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>API ingest</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                Push pipeline runs, quality checks and lineage events via <code className="font-mono">/api/v1/*</code> endpoints from any runtime.
              </p>
            </div>
            <div
              className="rounded-xl p-4 space-y-1.5"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Databricks sync</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                Pull from a Databricks SQL Warehouse via a scheduled or manual sync. Data is written to the same Postgres store on arrival.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {META_TABLES.map(({ icon: Icon, name, desc }) => (
              <div
                key={name}
                className="rounded-xl p-4 space-y-1.5"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
                  <span className="text-sm font-mono font-semibold" style={{ color: "var(--color-text)" }}>
                    {name}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {OPERATING_MODEL.map(({ icon: Icon, title, text }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                {text}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Layers3 className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
            Multi-tenant UX principles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            In a multi-tenant operating model, product clarity comes from strict separation between tenant-scoped work and cross-tenant governance.
            Settings and dashboards stay tenant-focused, while Admin Center handles installation, access and security operations.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {MULTI_TENANT_UX_PRINCIPLES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-xl p-4 space-y-2"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{title}</p>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div
        className="flex flex-col gap-3 rounded-xl px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>Platform context</p>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Latero Control is part of the Latero Meta Data Control Framework platform.
          </p>
        </div>
        <a
          href="https://latero.nl"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
          style={{ color: "var(--color-accent)" }}
        >
          Visit latero.nl <ArrowRight className="h-4 w-4" /> <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function JourneyStep({ title, text }: { title: string; text: string }) {
  return (
    <div
      className="rounded-xl p-4 space-y-2"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{title}</p>
      <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{text}</p>
    </div>
  );
}
