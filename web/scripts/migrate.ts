/**
 * db:migrate — Voert alle nog-niet-toegepaste SQL-migraties uit.
 *
 * Leest alle *.sql bestanden uit infra/sql/init/, vergelijkt ze met
 * de schema_migrations tabel, en voert ontbrekende migraties sequentieel
 * uit in filename-volgorde. Idempotent en veilig om meerdere keren te draaien.
 *
 * Gebruik: npm run db:migrate
 * Of bij deploy: tsx scripts/migrate.ts
 */

import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  `postgresql://${process.env.PGUSER ?? "insights"}:${process.env.PGPASSWORD ?? "insights"}@${process.env.PGHOST ?? "localhost"}:${process.env.PGPORT ?? "5432"}/${process.env.PGDATABASE ?? "insights"}`;

const MIGRATIONS_DIR = resolve(__dirname, "../../infra/sql/init");

async function migrate() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Zorg dat de tracking tabel altijd bestaat (ook als 000 nog niet gedraaid is)
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Haal al toegepaste migraties op
    const applied = await client.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations ORDER BY filename"
    );
    const appliedSet = new Set(applied.rows.map((r) => r.filename));

    // Lees en sorteer alle .sql bestanden
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
      console.log(`  → ${file}`);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
          [file]
        );
        await client.query("COMMIT");
        ran++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  ✗ FAILED: ${file}`);
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
      }
    }

    if (ran === 0) {
      console.log("  ✓ Database is up to date, geen migraties uitstaan.");
    } else {
      console.log(`  ✓ ${ran} migratie(s) succesvol toegepast.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

console.log("Latero Control — database migraties");
console.log(`Database: ${DATABASE_URL.replace(/:\/\/[^@]+@/, "://<credentials>@")}`);
migrate().catch((err) => {
  console.error("Migratie mislukt:", err);
  process.exit(1);
});
