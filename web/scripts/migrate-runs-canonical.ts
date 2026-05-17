/**
 * db:migrate:runs-canonical
 *
 * Helper around migration 060_runs_canonical_task_execution.sql.
 *
 * Modes:
 * - default / --check: inspect current schema and data readiness
 * - --apply: run all pending migrations via the standard migrator
 * - --validate: validate the canonical meta.runs shape after migration
 *
 * Usage:
 *   npm run db:migrate:runs-canonical
 *   npm run db:migrate:runs-canonical -- --apply
 *   npm run db:migrate:runs-canonical -- --validate
 */

import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { spawnSync } from "child_process";
import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  `postgresql://${process.env.PGUSER ?? "insights"}:${process.env.PGPASSWORD ?? "insights"}@${process.env.PGHOST ?? "localhost"}:${process.env.PGPORT ?? "5432"}/${process.env.PGDATABASE ?? "insights"}`;

const MIGRATIONS_DIR = (() => {
  const candidates = [
    process.env.MIGRATIONS_DIR,
    resolve(__dirname, "../../infra/sql/init"),
    resolve(__dirname, "infra/sql/init"),
  ].filter(Boolean) as string[];
  for (const dir of candidates) {
    try {
      readdirSync(dir);
      return dir;
    } catch {
      // try next
    }
  }
  throw new Error("Kan de migratiemap niet vinden. Stel MIGRATIONS_DIR in.");
})();

const TARGET_MIGRATION = "060_runs_canonical_task_execution.sql";

async function tableHasColumn(pool: Pool, columnName: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'meta'
         AND table_name = 'runs'
         AND column_name = $1
     ) AS exists`,
    [columnName],
  );
  return result.rows[0]?.exists ?? false;
}

async function migrationApplied(pool: Pool, filename: string): Promise<boolean> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE filename = $1) AS exists`,
    [filename],
  );
  return result.rows[0]?.exists ?? false;
}

async function preflight(pool: Pool): Promise<void> {
  const hasTaskName = await tableHasColumn(pool, "task_name");
  const hasSourceParent = await tableHasColumn(pool, "source_parent_run_id");
  const hasTaskKey = await tableHasColumn(pool, "task_key");
  const hasDbxParent = await tableHasColumn(pool, "dbx_job_run_id");

  console.log("Preflight meta.runs");
  console.log(`- migration 060 applied: ${await migrationApplied(pool, TARGET_MIGRATION) ? "yes" : "no"}`);
  console.log(`- has task_name: ${hasTaskName ? "yes" : "no"}`);
  console.log(`- has source_parent_run_id: ${hasSourceParent ? "yes" : "no"}`);
  console.log(`- has legacy task_key: ${hasTaskKey ? "yes" : "no"}`);
  console.log(`- has legacy dbx_job_run_id: ${hasDbxParent ? "yes" : "no"}`);

  const runCount = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM meta.runs");
  console.log(`- total meta.runs rows: ${runCount.rows[0]?.count ?? "0"}`);

  if (hasTaskKey || hasDbxParent) {
    const result = await pool.query<{
      rows_missing_task_name: string;
      rows_missing_parent: string;
      collisions_after_backfill: string;
    }>(`
      WITH base AS (
        SELECT
          installation_id,
          external_run_id,
          run_date,
          COALESCE(NULLIF(task_name, ''), NULLIF(task_key, ''), NULLIF(external_run_id, ''), 'unknown-task') AS canonical_task_name
        FROM meta.runs
      ),
      collisions AS (
        SELECT installation_id, external_run_id, canonical_task_name, run_date
        FROM base
        GROUP BY installation_id, external_run_id, canonical_task_name, run_date
        HAVING COUNT(*) > 1
      )
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(task_name, '') = ''
        )::text AS rows_missing_task_name,
        COUNT(*) FILTER (
          WHERE COALESCE(source_parent_run_id, dbx_job_run_id, '') = ''
        )::text AS rows_missing_parent,
        (SELECT COUNT(*)::text FROM collisions) AS collisions_after_backfill
      FROM meta.runs
    `);
    const row = result.rows[0];
    console.log(`- rows that need task_name backfill: ${row?.rows_missing_task_name ?? "0"}`);
    console.log(`- rows without source parent after fallback: ${row?.rows_missing_parent ?? "0"}`);
    console.log(`- duplicate-key collisions after backfill: ${row?.collisions_after_backfill ?? "0"}`);
  }
}

async function validate(pool: Pool): Promise<void> {
  const hasTaskName = await tableHasColumn(pool, "task_name");
  const hasSourceParent = await tableHasColumn(pool, "source_parent_run_id");
  const hasTaskKey = await tableHasColumn(pool, "task_key");
  const hasDbxParent = await tableHasColumn(pool, "dbx_job_run_id");

  console.log("Validation meta.runs");
  console.log(`- task_name present: ${hasTaskName ? "yes" : "no"}`);
  console.log(`- source_parent_run_id present: ${hasSourceParent ? "yes" : "no"}`);
  console.log(`- legacy task_key dropped: ${hasTaskKey ? "no" : "yes"}`);
  console.log(`- legacy dbx_job_run_id dropped: ${hasDbxParent ? "no" : "yes"}`);

  const result = await pool.query<{
    null_task_name_rows: string;
    duplicate_canonical_rows: string;
  }>(`
    WITH duplicates AS (
      SELECT installation_id, external_run_id, task_name, run_date
      FROM meta.runs
      GROUP BY installation_id, external_run_id, task_name, run_date
      HAVING COUNT(*) > 1
    )
    SELECT
      COUNT(*) FILTER (WHERE task_name IS NULL OR trim(task_name) = '')::text AS null_task_name_rows,
      (SELECT COUNT(*)::text FROM duplicates) AS duplicate_canonical_rows
    FROM meta.runs
  `);

  const row = result.rows[0];
  console.log(`- null/empty task_name rows: ${row?.null_task_name_rows ?? "0"}`);
  console.log(`- duplicate canonical key groups: ${row?.duplicate_canonical_rows ?? "0"}`);
}

function runStandardMigrator(): void {
  const scriptPath = resolve(__dirname, "migrate.ts");
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL, MIGRATIONS_DIR },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    if (args.has("--apply")) {
      console.log(`Applying pending migrations via standard migrator (target includes ${TARGET_MIGRATION})`);
      runStandardMigrator();
    }

    if (!args.has("--apply") || args.has("--check")) {
      await preflight(pool);
    }

    if (args.has("--validate") || args.has("--apply")) {
      await validate(pool);
    }

    const migrationPath = join(MIGRATIONS_DIR, TARGET_MIGRATION);
    const migrationPreview = readFileSync(migrationPath, "utf-8")
      .split("\n")
      .slice(0, 12)
      .join("\n");
    console.log("\nMigration preview:");
    console.log(migrationPreview);
  } finally {
    await pool.end();
  }
}

console.log("Latero Control — canonical runs migration helper");
console.log(`Database: ${DATABASE_URL.replace(/:\/\/[^@]+@/, "://<credentials>@")}`);
main().catch((err) => {
  console.error("Script mislukt:", err);
  process.exit(1);
});
