import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { writeToCache } from "@/lib/cache";
import { loadSettings, saveSettings } from "@/lib/settings";

// --- Config ---

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const FROM = daysAgoIso(30);
const TO = todayIso();

const DATASETS = [
  { dataset: "cbsenergie", source_system: "cbs" },
  { dataset: "eponline", source_system: "ep_online" },
  { dataset: "rvosde", source_system: "rvo" },
] as const;

const STEPS = ["landing_to_raw", "raw_to_bronze", "bronze_to_silver", "silver_to_gold"] as const;

const DQ_CHECKS = [
  { check_id: "schema_validation", category: "schema" },
  { check_id: "not_null_check", category: "completeness" },
  { check_id: "range_check", category: "accuracy" },
  { check_id: "completeness_check", category: "completeness" },
  { check_id: "referential_integrity", category: "consistency" },
  { check_id: "freshness_check", category: "timeliness" },
  { check_id: "uniqueness_check", category: "consistency" },
  { check_id: "format_check", category: "accuracy" },
] as const;

const COLUMN_LINEAGE: Record<string, { source: string[]; target: string[] }> = {
  cbsenergie: {
    source: ["woningtype", "bouwjaar", "energielabel", "gas_m3", "elektriciteit_kwh", "postcode"],
    target: ["woningtype", "bouwjaar", "energielabel", "gas_m3", "elektriciteit_kwh", "postcode", "energy_kwh", "co2_emissions"],
  },
  eponline: {
    source: ["pand_id", "label_klasse", "registratiedatum", "opnamedatum", "ep_waarde", "gebouwtype"],
    target: ["pand_id", "label_klasse", "registratiedatum", "opnamedatum", "ep_waarde", "gebouwtype", "label_numeric"],
  },
  rvosde: {
    source: ["project_id", "technologie", "vermogen_kw", "subsidie_bedrag", "status", "provincie"],
    target: ["project_id", "technologie", "vermogen_kw", "subsidy_amount", "status", "provincie", "vermogen_mw"],
  },
};

const STEP_DURATION: Record<string, [number, number]> = {
  landing_to_raw: [1200, 3500],
  raw_to_bronze: [3000, 8000],
  bronze_to_silver: [6000, 18000],
  silver_to_gold: [10000, 45000],
};

// --- Helpers ---

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

const rng = seededRandom(20260417);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function weightedStatus(successPct: number, warningPct: number): string {
  const r = rng();
  if (r < successPct) return "SUCCESS";
  if (r < successPct + warningPct) return "WARNING";
  return "FAILED";
}

function randomTime(dateStr: string): string {
  const h = String(randInt(6, 22)).padStart(2, "0");
  const m = String(randInt(0, 59)).padStart(2, "0");
  const s = String(randInt(0, 59)).padStart(2, "0");
  return `${dateStr}T${h}:${m}:${s}.${randInt(100, 999)}Z`;
}

function getDatesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// --- Generators ---

function generatePipelines(): unknown[] {
  const records: unknown[] = [];
  const dates = getDatesInRange(FROM, TO);

  for (const date of dates) {
    for (const { dataset, source_system } of DATASETS) {
      if (rng() > 0.33) continue;

      for (const step of STEPS) {
        const [minDur, maxDur] = STEP_DURATION[step];
        const status = weightedStatus(0.85, 0.10);
        const duration = status === "FAILED" ? randInt(500, minDur) : randInt(minDur, maxDur);
        const timestamp = randomTime(date);

        records.push({
          event_type: "pipeline_run",
          timestamp_utc: timestamp,
          event_date: date,
          dataset_id: dataset,
          source_system,
          step,
          run_id: randomUUID(),
          run_status: status,
          duration_ms: duration,
          environment: "development",
        });
      }
    }
  }
  return records;
}

function generateQuality(): unknown[] {
  const records: unknown[] = [];
  const dates = getDatesInRange(FROM, TO);
  const dqSteps = ["raw_to_bronze", "bronze_to_silver"] as const;

  for (const date of dates) {
    for (const { dataset } of DATASETS) {
      if (rng() > 0.50) continue;

      const checksToRun = DQ_CHECKS.filter(() => rng() > 0.45);

      for (const check of checksToRun) {
        const step = pick(dqSteps);
        const status = weightedStatus(0.80, 0.12);
        const timestamp = randomTime(date);

        records.push({
          event_type: "dq_check",
          timestamp_utc: timestamp,
          event_date: date,
          dataset_id: dataset,
          step,
          run_id: randomUUID(),
          check_id: check.check_id,
          check_status: status,
          check_category: check.category,
          policy_version: "1.0.0",
        });
      }
    }
  }
  return records;
}

function generateLineage(): unknown[] {
  const records: unknown[] = [];
  const layers: Array<{
    source_layer: string;
    target_layer: string;
    step: string;
    source_suffix: string;
    target_suffix: string;
  }> = [
    { source_layer: "landing", target_layer: "raw", step: "landing_to_raw", source_suffix: "_raw", target_suffix: "" },
    { source_layer: "raw", target_layer: "bronze", step: "raw_to_bronze", source_suffix: "", target_suffix: "" },
    { source_layer: "bronze", target_layer: "silver", step: "bronze_to_silver", source_suffix: "", target_suffix: "" },
    { source_layer: "silver", target_layer: "gold", step: "silver_to_gold", source_suffix: "", target_suffix: "_metrics" },
  ];

  for (const { dataset } of DATASETS) {
    const cols = COLUMN_LINEAGE[dataset];

    for (const layer of layers) {
      const sourceName = `${dataset}${layer.source_suffix}`;
      const targetName = `${dataset}${layer.target_suffix}`;

      records.push({
        event_type: "lineage_hop",
        timestamp_utc: randomTime(TO),
        event_date: TO,
        dataset_id: dataset,
        step: layer.step,
        run_id: randomUUID(),
        source_entity: sourceName,
        source_type: "table",
        source_ref: `workspace.${layer.source_layer}.${sourceName}`,
        source_attribute: null,
        target_entity: targetName,
        target_type: "table",
        target_ref: `workspace.${layer.target_layer}.${targetName}`,
        target_attribute: null,
      });

      if (layer.step === "bronze_to_silver" || layer.step === "silver_to_gold") {
        const maxCols = Math.min(cols.source.length, cols.target.length);
        for (let i = 0; i < maxCols; i++) {
          records.push({
            event_type: "lineage_hop",
            timestamp_utc: randomTime(TO),
            event_date: TO,
            dataset_id: dataset,
            step: layer.step,
            run_id: randomUUID(),
            source_entity: sourceName,
            source_type: "table",
            source_ref: `workspace.${layer.source_layer}.${sourceName}`,
            source_attribute: cols.source[i],
            target_entity: targetName,
            target_type: "table",
            target_ref: `workspace.${layer.target_layer}.${targetName}`,
            target_attribute: cols.target[i],
          });
        }
      }
    }
  }
  return records;
}

// --- Route handler ---

export async function POST() {
  try {
    const params = { from: FROM, to: TO };

    const pipelines = generatePipelines();
    writeToCache("pipelines", params, pipelines);

    const quality = generateQuality();
    writeToCache("quality", params, quality);

    const lineage = generateLineage();
    writeToCache("lineage", params, lineage);

    // Enable cache-only mode
    const settings = loadSettings();
    saveSettings({ ...settings, cacheOnly: true, cacheTtlSeconds: 604800 });

    return NextResponse.json({
      seeded: {
        pipelines: pipelines.length,
        quality: quality.length,
        lineage: lineage.length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 },
    );
  }
}
