/**
 * Seed script for Latero Meta Insights demo cache.
 * Generates realistic ESG pipeline data so the app works without Databricks.
 *
 * Usage: node scripts/seed-cache.mjs
 */

import { createHash } from "crypto";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", ".cache");

// ---------------------------------------------------------------------------
// Cache key algorithm — must match src/lib/cache.ts exactly
// ---------------------------------------------------------------------------
function cacheKey(endpoint, params) {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  const hash = createHash("sha256").update(`${endpoint}?${sorted}`).digest("hex").slice(0, 16);
  return `${endpoint}_${hash}`;
}

// ---------------------------------------------------------------------------
// Deterministic pseudo-random (mulberry32)
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260417);

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function uuid() {
  const hex = () => randInt(0, 255).toString(16).padStart(2, "0");
  return [
    hex() + hex() + hex() + hex(),
    hex() + hex(),
    "4" + hex().slice(1) + hex(),
    (8 + randInt(0, 3)).toString(16) + hex().slice(1) + hex(),
    hex() + hex() + hex() + hex() + hex() + hex(),
  ].join("-");
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const FROM = "2026-03-18";
const TO = "2026-04-17";
const PARAMS = { from: FROM, to: TO };
const CACHED_AT = "2026-04-17T12:00:00.000Z";

const DATASETS = [
  { id: "cbsenergie", source: "CBS" },
  { id: "eponline", source: "EP Online" },
  { id: "rvosde", source: "RVO" },
];

const STEPS = ["landing_to_raw", "raw_to_bronze", "bronze_to_silver", "silver_to_gold"];

const CHECKS_BY_DATASET = {
  cbsenergie: [
    { check_id: "not_null_energy_kwh", category: "completeness" },
    { check_id: "range_energy_kwh", category: "accuracy" },
    { check_id: "valid_year", category: "accuracy" },
    { check_id: "unique_record_id", category: "consistency" },
  ],
  eponline: [
    { check_id: "not_null_label_class", category: "completeness" },
    { check_id: "valid_label_class", category: "accuracy" },
    { check_id: "valid_registration_date", category: "accuracy" },
    { check_id: "unique_building_id", category: "consistency" },
  ],
  rvosde: [
    { check_id: "not_null_capacity_kw", category: "completeness" },
    { check_id: "range_capacity_kw", category: "accuracy" },
    { check_id: "valid_technology_type", category: "accuracy" },
    { check_id: "unique_installation_id", category: "consistency" },
  ],
};

const LINEAGE_CHAIN = [
  { step: "landing_to_raw", srcPrefix: "landing", srcSuffix: "_file", srcType: "file", tgtPrefix: "raw", tgtSuffix: "", tgtType: "table" },
  { step: "raw_to_bronze", srcPrefix: "raw", srcSuffix: "", srcType: "table", tgtPrefix: "bronze", tgtSuffix: "", tgtType: "table" },
  { step: "bronze_to_silver", srcPrefix: "bronze", srcSuffix: "", srcType: "table", tgtPrefix: "silver", tgtSuffix: "", tgtType: "table" },
  { step: "silver_to_gold", srcPrefix: "silver", srcSuffix: "", srcType: "table", tgtPrefix: "gold", tgtSuffix: "", tgtType: "table" },
];

const COLUMN_HOPS = {
  cbsenergie: [
    ["energy_kwh", "energy_kwh"],
    ["year", "report_year"],
    ["record_id", "record_id"],
  ],
  eponline: [
    ["label_class", "label_class"],
    ["registration_date", "registration_date"],
    ["building_id", "building_id"],
  ],
  rvosde: [
    ["capacity_kw", "capacity_kw"],
    ["technology_type", "technology_type"],
    ["installation_id", "installation_id"],
  ],
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function daysInRange() {
  const dates = [];
  const start = new Date(FROM + "T00:00:00Z");
  const end = new Date(TO + "T00:00:00Z");
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function isoTimestamp(date, hour, minute, second) {
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}.000Z`;
}

// ---------------------------------------------------------------------------
// Generate pipeline runs
// ---------------------------------------------------------------------------
function generatePipelineRuns() {
  const runs = [];
  const dates = daysInRange();

  for (const date of dates) {
    for (const ds of DATASETS) {
      // Not every dataset runs every day — skip ~15% of days per dataset
      if (rand() < 0.15) continue;

      const baseHour = randInt(6, 10);
      for (let si = 0; si < STEPS.length; si++) {
        const step = STEPS[si];

        // Determine status
        const r = rand();
        let status;
        if (r < 0.03) status = "FAILED";
        else if (r < 0.10) status = "WARNING";
        else status = "SUCCESS";

        const isEarly = si < 2;
        const duration = isEarly ? randInt(1000, 30000) : randInt(5000, 120000);

        const hour = baseHour + si;
        const minute = randInt(0, 59);
        const second = randInt(0, 59);

        runs.push({
          event_type: "pipeline_run",
          timestamp_utc: isoTimestamp(date, hour, minute, second),
          event_date: date,
          dataset_id: ds.id,
          source_system: ds.source,
          step,
          run_id: uuid(),
          run_status: status,
          duration_ms: status === "FAILED" && rand() < 0.5 ? null : duration,
          environment: "development",
        });

        // If step failed, don't continue to next steps
        if (status === "FAILED") break;
      }
    }
  }

  return runs;
}

// ---------------------------------------------------------------------------
// Generate DQ checks
// ---------------------------------------------------------------------------
function generateDqChecks(runs) {
  const checks = [];

  for (const run of runs) {
    const datasetChecks = CHECKS_BY_DATASET[run.dataset_id];
    if (!datasetChecks) continue;

    // Pick 2–4 checks per run
    const numChecks = randInt(2, Math.min(4, datasetChecks.length));
    const shuffled = [...datasetChecks].sort(() => rand() - 0.5);
    const selected = shuffled.slice(0, numChecks);

    for (const chk of selected) {
      const r = rand();
      let status;
      if (r < 0.02) status = "FAILED";
      else if (r < 0.05) status = "WARNING";
      else status = "SUCCESS";

      // If pipeline run failed, at least one check should fail
      if (run.run_status === "FAILED" && rand() < 0.6) {
        status = "FAILED";
      }

      checks.push({
        event_type: "dq_check",
        timestamp_utc: run.timestamp_utc,
        event_date: run.event_date,
        dataset_id: run.dataset_id,
        step: run.step,
        run_id: run.run_id,
        check_id: chk.check_id,
        check_status: status,
        check_category: chk.category,
        policy_version: "1.0",
      });
    }
  }

  return checks;
}

// ---------------------------------------------------------------------------
// Generate lineage hops
// ---------------------------------------------------------------------------
function generateLineageHops(runs) {
  const hops = [];
  const seen = new Set();

  for (const run of runs) {
    const chain = LINEAGE_CHAIN.find(c => c.step === run.step);
    if (!chain) continue;

    const dedup = `${run.dataset_id}:${run.step}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    const srcEntity = `${chain.srcPrefix}.${run.dataset_id}${chain.srcSuffix}`;
    const tgtEntity = chain.step === "silver_to_gold"
      ? "gold.energy_overview"
      : `${chain.tgtPrefix}.${run.dataset_id}${chain.tgtSuffix}`;

    const srcRef = `workspace.${srcEntity}`;
    const tgtRef = `workspace.${tgtEntity}`;

    // Table-level hop
    hops.push({
      event_type: "lineage_hop",
      timestamp_utc: run.timestamp_utc,
      event_date: run.event_date,
      dataset_id: run.dataset_id,
      step: run.step,
      run_id: run.run_id,
      source_entity: srcEntity,
      source_type: chain.srcType,
      source_ref: srcRef,
      source_attribute: null,
      target_entity: tgtEntity,
      target_type: chain.tgtType,
      target_ref: tgtRef,
      target_attribute: null,
    });

    // Column-level hops for bronze_to_silver and silver_to_gold
    if (chain.step === "bronze_to_silver" || chain.step === "silver_to_gold") {
      const cols = COLUMN_HOPS[run.dataset_id] || [];
      for (const [srcCol, tgtCol] of cols) {
        hops.push({
          event_type: "lineage_hop",
          timestamp_utc: run.timestamp_utc,
          event_date: run.event_date,
          dataset_id: run.dataset_id,
          step: run.step,
          run_id: run.run_id,
          source_entity: srcEntity,
          source_type: chain.srcType,
          source_ref: srcRef,
          source_attribute: srcCol,
          target_entity: tgtEntity,
          target_type: chain.tgtType,
          target_ref: tgtRef,
          target_attribute: tgtCol,
        });
      }
    }
  }

  return hops;
}

// ---------------------------------------------------------------------------
// Write cache files
// ---------------------------------------------------------------------------
function writeCacheFile(endpoint, params, data) {
  const key = cacheKey(endpoint, params);
  const filePath = join(CACHE_DIR, `${key}.json`);
  const entry = {
    data,
    cachedAt: CACHED_AT,
    endpoint,
    params,
  };
  writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf-8");
  return { key, filePath, count: Array.isArray(data) ? data.length : 1 };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

const runs = generatePipelineRuns();
const checks = generateDqChecks(runs);
const hops = generateLineageHops(runs);

const results = [];
results.push(writeCacheFile("pipelines", PARAMS, runs));
results.push(writeCacheFile("quality", PARAMS, checks));
results.push(writeCacheFile("lineage", PARAMS, hops));

// Write settings.json
const settingsPath = join(CACHE_DIR, "settings.json");
const settings = {
  databricksHost: "",
  databricksToken: "",
  databricksWarehouseId: "",
  databricksCatalog: "workspace",
  databricksSchema: "meta",
  cacheTtlSeconds: 604800,
  cacheOnly: true,
};
writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");

console.log("Latero Meta Insights — seed cache created\n");
console.log(`  Date range: ${FROM} → ${TO}\n`);
for (const r of results) {
  console.log(`  ${r.key}.json — ${r.count} records`);
}
console.log(`  settings.json — cacheOnly: true\n`);
console.log(`Cache directory: ${CACHE_DIR}`);
