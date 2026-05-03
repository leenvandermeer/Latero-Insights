"use client";

import { usePipelines, useQuality, useLineageEntities } from "@/hooks";
import { CounterCard, CounterCardSkeleton } from "@/components/ui";
import { ClipboardCheck } from "lucide-react";
import { latestPipelineStepRuns } from "@/lib/pipeline-runs";

interface Props {
  from: string;
  to: string;
  titleOverride?: string;
}

export function Bcbs239ScoreWidget({ from, to, titleOverride }: Props) {
  const { data: pipelineRes, isLoading: lp } = usePipelines(from, to);
  const { data: qualityRes, isLoading: lq } = useQuality(from, to);
  const { data: lineageRes, isLoading: ll } = useLineageEntities();

  if (lp || lq || ll) return <CounterCardSkeleton />;

  const runs = latestPipelineStepRuns(pipelineRes?.data ?? []);
  const checks = qualityRes?.data ?? [];
  const entities = lineageRes?.data ?? [];

  const totalRuns = runs.length;
  const successRuns = runs.filter((r) => ["SUCCESS", "PASS"].includes(r.run_status.toUpperCase())).length;
  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => ["SUCCESS", "PASS"].includes(c.check_status.toUpperCase())).length;

  const datasets = new Set([...runs.map((r) => r.dataset_id), ...checks.map((c) => c.dataset_id)]);
  const lineageDatasets = new Set(entities.map((entity) => entity.dataset_id).filter((value): value is string => Boolean(value)));

  const scores = [
    totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0,
    totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0,
    totalRuns > 0 ? Math.round((runs.filter((r) => r.duration_ms != null).length / totalRuns) * 100) : 0,
    datasets.size > 0 ? Math.round((Math.min(lineageDatasets.size, datasets.size) / datasets.size) * 100) : 0,
  ];

  const overall = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

  return (
    <CounterCard
      label={titleOverride ?? "BCBS-239 Score"}
      value={`${overall}%`}
      icon={<ClipboardCheck className="h-5 w-5" />}
    />
  );
}
