import type { PipelineRun } from "@/lib/adapters/types";

export function latestPipelineStepRuns(runs: PipelineRun[]): PipelineRun[] {
  const latest = new Map<string, PipelineRun>();

  for (const run of runs) {
    const key = `${run.dataset_id}::${run.step}`;
    const existing = latest.get(key);
    if (!existing || run.timestamp_utc > existing.timestamp_utc) {
      latest.set(key, run);
    }
  }

  return [...latest.values()].sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc));
}

export function latestPipelineStepRunsByDate(runs: PipelineRun[]): PipelineRun[] {
  const latest = new Map<string, PipelineRun>();

  for (const run of runs) {
    const key = `${run.event_date}::${run.dataset_id}::${run.step}`;
    const existing = latest.get(key);
    if (!existing || run.timestamp_utc > existing.timestamp_utc) {
      latest.set(key, run);
    }
  }

  return [...latest.values()].sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc));
}
