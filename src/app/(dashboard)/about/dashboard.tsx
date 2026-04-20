"use client";

import { PageHeader } from "@/components/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Database, ShieldCheck, GitBranch, BarChart2, ExternalLink } from "lucide-react";

export function AboutDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product"
        title="Latero Meta Data Control Framework"
        description="Latero MDCF & Latero Meta Insights — pipeline metadata, data quality, and lineage in one integrated platform."
      />

      {/* Two products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
              Latero Meta Data Control Framework
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              A platform-agnostic metadata control runtime that captures pipeline execution, data quality, and lineage as a built-in property of every pipeline run — not as an afterthought.
            </p>
            <ul className="space-y-2">
              {[
                "Policy-driven DQ engine — enforce vs. observe per check",
                "Event-sourced audit trail across all pipeline steps",
                "OpenLineage-compatible lineage registration",
                "Runs on Databricks and Snowflake",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--color-accent)" }} />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
              Latero Meta Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              A standalone web application that visualizes pipeline metadata, data quality, and lineage from the Latero meta tables. Reads directly from the three meta tables the framework writes to.
            </p>
            <ul className="space-y-2">
              {[
                "Pipeline health dashboards and run history",
                "DQ check results, pass rates, and trend analysis",
                "Interactive lineage explorer with OpenLineage export",
                "Custom dashboards and widget builder",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--color-accent)" }} />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Meta tables */}
      <Card>
        <CardHeader>
          <CardTitle>Meta Tables</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
            Latero MDCF writes to three meta tables. Latero Meta Insights reads from the same tables.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Database, name: "pipeline_runs", desc: "Execution events — step timing, status, and run context" },
              { icon: ShieldCheck, name: "data_quality_checks", desc: "DQ check results — severity, status, and observed values" },
              { icon: GitBranch, name: "data_lineage", desc: "Column-level lineage hops — source, target, and attributes" },
            ].map(({ icon: Icon, name, desc }) => (
              <div
                key={name}
                className="rounded-xl p-4 space-y-1.5"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
                  <span className="text-sm font-mono font-semibold" style={{ color: "var(--color-text)" }}>{name}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Version */}
      <div className="flex items-center justify-between rounded-xl px-5 py-3 text-xs" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
        <span>Latero Meta Data Control Framework & Latero Meta Insights</span>
        <a
          href="https://latero.nl"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:underline"
          style={{ color: "var(--color-accent)" }}
        >
          latero.nl <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
