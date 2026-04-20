"use client";

import { PageHeader } from "@/components/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Database, ShieldCheck, GitBranch, BarChart2, ExternalLink } from "lucide-react";

export function AboutDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product"
        title="Latero Meta Insights"
        description="Latero Meta Insights visualiseert pipeline metadata, datakwaliteit en lineage — rechtstreeks uit de meta-tabellen van het Latero Meta Data Controle Framework (MDCF)."
      />

      {/* Two products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
              Latero Meta Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              Een standalone webapplicatie die pipeline-metadata, datakwaliteit en lineage visualiseert vanuit de Latero meta-tabellen. Leest rechtstreeks uit de drie meta-tabellen die het framework vult.
            </p>
            <ul className="space-y-2">
              {[
                "Pipeline health dashboards en run-history",
                "DQ check resultaten, slagingspercentages en trendanalyse",
                "Interactieve lineage explorer met OpenLineage export",
                "Aangepaste dashboards en widget builder",
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
              <Database className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
              Latero Meta Data Controle Framework
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              Een platform-agnostische metadata control runtime die pipeline-executie, datakwaliteit en lineage vastlegt als ingebouwde eigenschap van elke pipeline run — geen nagedachte.
            </p>
            <ul className="space-y-2">
              {[
                "Policy-gedreven DQ-engine — enforce vs. observe per check",
                "Event-sourced audittrail over alle pipeline-stappen",
                "OpenLineage-compatibele lineage-registratie",
                "Draait op Databricks en Snowflake",
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
            Het Latero MDCF schrijft naar drie meta-tabellen. Latero Meta Insights leest uit dezelfde tabellen.
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
        <span>Latero Meta Insights — onderdeel van het Latero MDCF platform</span>
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
