"""Sync logic: reads from Latero current-state tables, pushes to OpenMetadata.

Entry point: sync_from_spark()
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Callable

from latero.connectors.openmetadata.client import OpenMetadataClient

_log = logging.getLogger(__name__)

# Ordered medallion layers, used when computing last_completed_layer.
_LAYER_ORDER = ["landing", "raw", "bronze", "silver", "gold"]


def _default_fqn_mapper(entity_fqn: str, service_name: str) -> str:
    """Map a Latero entity_fqn to an OpenMetadata table FQN.

    Default: ``{service_name}.{entity_name}`` where entity_name is the last
    segment of the Latero FQN (``environment.dataset_id.entity_name``).

    Override this for installations that use a different table naming scheme.
    """
    entity_name = entity_fqn.rsplit(".", 1)[-1]
    return f"{service_name}.{entity_name}"


def _default_schema_fqn(service_name: str, layer: str) -> str:
    """Map a service name + layer to an OpenMetadata databaseSchema FQN.

    Default: ``{service_name}.{layer}``.
    """
    return f"{service_name}.{layer}"


def sync_from_spark(
    spark,
    tables: dict,
    client: OpenMetadataClient,
    *,
    service_name: str,
    fqn_mapper: Callable[[str, str], str] | None = None,
    schema_fqn_fn: Callable[[str, str], str] | None = None,
) -> dict:
    """Sync Latero current-state lineage to OpenMetadata.

    Reads ``lineage_entities_current`` and ``lineage_attributes_current`` from
    *tables* (as returned by ``get_log_tables()`` extended with the two
    current-state table names), pushes entities and lineage edges to
    OpenMetadata via *client*, then writes back ``openmetadata_entity_id`` and
    ``openmetadata_synced_at`` into ``lineage_entities_current``.

    Parameters
    ----------
    spark:
        Active SparkSession.
    tables:
        Dict with keys ``lineage_entities_current`` and
        ``lineage_attributes_current`` (plus the core meta-table keys).
    client:
        Configured :class:`OpenMetadataClient`.
    service_name:
        OpenMetadata database service name (e.g. ``"databricks_latero"``).
    fqn_mapper:
        Optional callable ``(entity_fqn, service_name) -> om_fqn`` that maps
        a Latero FQN to an OpenMetadata table FQN.
    schema_fqn_fn:
        Optional callable ``(service_name, layer) -> schema_fqn`` that returns
        the OpenMetadata databaseSchema FQN for a given layer.

    Returns
    -------
    dict
        ``{"entities_synced": int, "lineage_edges": int, "column_edges": int, "errors": list}``
    """
    _fqn = fqn_mapper or _default_fqn_mapper
    _schema = schema_fqn_fn or _default_schema_fqn

    errors: list[str] = []
    entities_synced = 0
    lineage_edges = 0
    column_edges = 0

    t_entities = tables["lineage_entities_current"]
    t_attrs = tables["lineage_attributes_current"]

    # ------------------------------------------------------------------ #
    # 1. Entity upsert                                                     #
    # ------------------------------------------------------------------ #
    entity_rows = spark.table(t_entities).collect()
    # entity_fqn → openmetadata_entity_id mapping for write-back
    entity_id_map: dict[str, str] = {}

    for row in entity_rows:
        efqn = row["entity_fqn"]
        om_fqn = _fqn(efqn, service_name)
        layer = row["layer"] or ""
        schema_fqn = _schema(service_name, layer)

        custom = {
            "latero_dataset_id": row["dataset_id"] or "",
            "latero_layer": layer,
            "latero_end_to_end_status": row["end_to_end_status"] or "",
            "latero_last_completed_layer": row["last_completed_layer"] or "",
            "latero_latest_success_at": row["latest_success_at"] or "",
        }

        try:
            # OpenMetadata FQN is service.db.schema.table — we only control
            # the table name; schema_fqn covers service.db.schema.
            table_name = om_fqn.rsplit(".", 1)[-1]
            entity_id = client.upsert_table(
                name=table_name,
                schema_fqn=schema_fqn,
                custom_properties=custom,
            )
            entity_id_map[efqn] = entity_id
            entities_synced += 1
            _log.debug("upserted entity %s → %s (%s)", efqn, om_fqn, entity_id)
        except Exception as exc:
            errors.append(f"entity upsert failed for {efqn}: {exc}")
            _log.warning("entity upsert failed for %s: %s", efqn, exc)

    # ------------------------------------------------------------------ #
    # 2. Dataset lineage edges (from upstream_entity_fqns)                #
    # ------------------------------------------------------------------ #
    for row in entity_rows:
        efqn = row["entity_fqn"]
        upstreams = row["upstream_entity_fqns"] or []
        if not upstreams or efqn not in entity_id_map:
            continue
        om_to = _fqn(efqn, service_name)
        for upstream_ref in upstreams:
            # upstream_ref is a raw source_ref (e.g. workspace.silver.silver_energielabel)
            # Try to find the matching entity by entity_fqn or source_ref
            om_from = _resolve_upstream_fqn(upstream_ref, entity_id_map, _fqn, service_name)
            if om_from is None:
                continue
            try:
                client.add_lineage(om_from, om_to)
                lineage_edges += 1
            except Exception as exc:
                errors.append(f"lineage edge failed {om_from} → {om_to}: {exc}")
                _log.warning("lineage edge failed %s → %s: %s", om_from, om_to, exc)

    # ------------------------------------------------------------------ #
    # 3. Column lineage edges (from lineage_attributes_current)           #
    # ------------------------------------------------------------------ #
    try:
        attr_rows = spark.table(t_attrs).filter("is_current = true").collect()
    except Exception as exc:
        errors.append(f"failed to read {t_attrs}: {exc}")
        attr_rows = []

    # Group by (source_entity_fqn, target_entity_fqn) to batch column lineage
    # into one add_lineage call per entity pair.
    edge_map: dict[tuple[str, str], list[dict]] = {}
    for row in attr_rows:
        src_efqn = row["source_entity_fqn"]
        tgt_efqn = row["target_entity_fqn"]
        src_attr = row["source_attribute"]
        tgt_attr = row["target_attribute"]
        if not (src_efqn and tgt_efqn and src_attr and tgt_attr):
            continue

        om_src = _fqn(src_efqn, service_name)
        om_tgt = _fqn(tgt_efqn, service_name)
        key = (om_src, om_tgt)
        edge_map.setdefault(key, []).append({
            "fromColumns": [f"{om_src}.{src_attr}"],
            "toColumn": f"{om_tgt}.{tgt_attr}",
        })

    for (om_from, om_to), col_edges in edge_map.items():
        try:
            client.add_lineage(om_from, om_to, column_lineage=col_edges)
            column_edges += len(col_edges)
        except Exception as exc:
            errors.append(f"column lineage failed {om_from} → {om_to}: {exc}")
            _log.warning("column lineage failed %s → %s: %s", om_from, om_to, exc)

    # ------------------------------------------------------------------ #
    # 4. Write back openmetadata_entity_id + openmetadata_synced_at       #
    # ------------------------------------------------------------------ #
    if entity_id_map:
        _write_back_entity_ids(spark, t_entities, entity_id_map)

    return {
        "entities_synced": entities_synced,
        "lineage_edges": lineage_edges,
        "column_edges": column_edges,
        "errors": errors,
    }


def _resolve_upstream_fqn(
    upstream_ref: str,
    entity_id_map: dict[str, str],
    fqn_mapper: Callable[[str, str], str],
    service_name: str,
) -> str | None:
    """Best-effort: map a raw upstream_ref to an OpenMetadata FQN.

    Tries to find the upstream in entity_id_map by matching the last segment
    of upstream_ref against known entity FQNs. Returns None if no match.
    """
    ref_tail = upstream_ref.rsplit(".", 1)[-1]
    for efqn in entity_id_map:
        entity_name = efqn.rsplit(".", 1)[-1]
        if entity_name == ref_tail:
            return fqn_mapper(efqn, service_name)
    return None


def _write_back_entity_ids(spark, table: str, entity_id_map: dict[str, str]) -> None:
    """Update openmetadata_entity_id and openmetadata_synced_at in the entities table."""
    now = datetime.now(timezone.utc).isoformat()
    rows = [
        {"entity_fqn": fqn, "openmetadata_entity_id": eid, "openmetadata_synced_at": now}
        for fqn, eid in entity_id_map.items()
    ]
    df = spark.createDataFrame(rows)
    df.createOrReplaceTempView("_om_writeback")
    spark.sql(f"""
        MERGE INTO {table} AS tgt
        USING _om_writeback AS src
          ON tgt.entity_fqn = src.entity_fqn
        WHEN MATCHED THEN UPDATE SET
          tgt.openmetadata_entity_id  = src.openmetadata_entity_id,
          tgt.openmetadata_synced_at  = src.openmetadata_synced_at
    """)
    spark.catalog.dropTempView("_om_writeback")
