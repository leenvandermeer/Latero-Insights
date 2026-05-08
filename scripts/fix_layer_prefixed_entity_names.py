#!/usr/bin/env python3
"""
Inspect (and optionally report) layer-prefixed entity names in Databricks
workspace.meta.lineage_entities_current.

Ghost entities like 'silver_gemeente_arbeid' arise when old framework versions
wrote dataset_id/name with the layer prefix included. This script:
  1. Queries Databricks for entities whose name starts with a layer prefix.
  2. Reports which canonical counterparts exist alongside them.
  3. Exits with code 1 if ghosts are found (useful in CI).

This is a READ-ONLY analysis script. The Postgres side is cleaned via
infra/sql/init/021_clean_layer_prefixed_entities.sql.

Usage:
  python3 scripts/fix_layer_prefixed_entity_names.py \\
    --host <databricks-host> --token <token> \\
    --warehouse <warehouse-id> --catalog <catalog> --schema meta

"""
import argparse
import json
import re
import sys
import time
import urllib.request
import urllib.error
from typing import Any

LAYER_PREFIXES = ("silver_", "gold_", "bronze_", "raw_", "landing_")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Report layer-prefixed ghost entities in Databricks")
    p.add_argument("--host", required=True, help="Databricks host, e.g. dbc-xxx.cloud.databricks.com")
    p.add_argument("--token", required=True, help="Databricks personal access token")
    p.add_argument("--warehouse", required=True, help="SQL warehouse ID")
    p.add_argument("--catalog", required=True, help="Unity Catalog catalog name")
    p.add_argument("--schema", required=True, help="Schema name (usually 'meta')")
    return p.parse_args()


def _api(host: str, token: str, method: str, path: str, body: dict | None = None) -> Any:
    url = f"https://{host}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def execute_statement(host: str, token: str, warehouse_id: str, sql: str) -> list[dict]:
    """Execute a SQL statement and return rows as list of dicts."""
    resp = _api(host, token, "POST", "/api/2.0/sql/statements", {
        "warehouse_id": warehouse_id,
        "statement": sql,
        "wait_timeout": "30s",
        "on_wait_timeout": "CANCEL",
    })

    state = resp.get("status", {}).get("state", "")
    statement_id = resp.get("statement_id")

    # Poll until terminal state
    while state in ("PENDING", "RUNNING"):
        time.sleep(1)
        resp = _api(host, token, "GET", f"/api/2.0/sql/statements/{statement_id}")
        state = resp.get("status", {}).get("state", "")

    if state != "SUCCEEDED":
        error = resp.get("status", {}).get("error", {})
        raise RuntimeError(f"Statement failed ({state}): {error.get('message', 'unknown error')}")

    result = resp.get("result", {})
    schema = resp.get("manifest", {}).get("schema", {}).get("columns", [])
    col_names = [c["name"] for c in schema]
    rows_data = result.get("data_array", []) or []
    return [dict(zip(col_names, row)) for row in rows_data]


def main() -> int:
    args = parse_args()
    fq_table = f"`{args.catalog}`.`{args.schema}`.`lineage_entities_current`"

    prefix_conditions = " OR ".join(
        f"name LIKE '{p}%'" for p in LAYER_PREFIXES
    )

    print(f"[info] Querying {fq_table} for layer-prefixed entity names ...")

    # First: detect available columns
    try:
        schema_rows = execute_statement(
            args.host, args.token, args.warehouse,
            f"SELECT * FROM {fq_table} LIMIT 0"
        )
        # columns come back empty but we can inspect via a different approach
    except Exception:
        pass

    # Use dataset_id as the entity identifier (matches meta-ingest and Postgres migration)
    try:
        all_rows = execute_statement(
            args.host, args.token, args.warehouse,
            f"SELECT DISTINCT dataset_id FROM {fq_table} WHERE dataset_id IS NOT NULL ORDER BY dataset_id"
        )
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"[error] HTTP {e.code}: {body}", file=sys.stderr)
        return 2
    except RuntimeError as e:
        print(f"[error] {e}", file=sys.stderr)
        return 2

    all_names = {r["dataset_id"] for r in all_rows}

    ghosts: list[tuple[str, str]] = []
    for name in sorted(all_names):
        for prefix in LAYER_PREFIXES:
            if name.startswith(prefix):
                canonical = re.sub(f"^({prefix[:-1]})_", "", name, count=1)
                ghosts.append((name, canonical))
                break

    if not ghosts:
        print("[ok] No layer-prefixed ghost entities found.")
        return 0

    print(f"\n[warn] Found {len(ghosts)} ghost entity name(s):\n")
    print(f"  {'Ghost name':<40}  {'Canonical':<40}  {'Canonical exists?'}")
    print(f"  {'-'*40}  {'-'*40}  {'-'*17}")
    for ghost, canonical in ghosts:
        exists = "YES" if canonical in all_names else "no"
        print(f"  {ghost:<40}  {canonical:<40}  {exists}")

    print(f"\n[action] Run infra/sql/init/021_clean_layer_prefixed_entities.sql")
    print(f"         against your Postgres instance to merge these ghosts.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
