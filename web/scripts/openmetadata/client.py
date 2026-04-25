"""Minimal OpenMetadata REST client.

Uses requests directly — no openmetadata-ingestion SDK dependency.
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import quote

import requests

_log = logging.getLogger(__name__)


class OpenMetadataClient:
    """Thin wrapper around the OpenMetadata REST API.

    Parameters
    ----------
    server_url:
        Base URL of the OpenMetadata server, e.g. ``https://openmetadata.example.com``.
    bearer_token:
        JWT bearer token for authentication.
    timeout:
        Request timeout in seconds.
    """

    def __init__(self, server_url: str, bearer_token: str, *, timeout: int = 30) -> None:
        self._base = server_url.rstrip("/") + "/api/v1"
        self._session = requests.Session()
        self._session.headers.update({
            "Authorization": f"Bearer {bearer_token}",
            "Content-Type": "application/json",
        })
        self._timeout = timeout

    # ------------------------------------------------------------------
    # Table entities
    # ------------------------------------------------------------------

    def get_table(self, fqn: str) -> dict | None:
        """Return the table entity dict for *fqn*, or None if it does not exist."""
        encoded = quote(fqn, safe="")
        resp = self._session.get(
            f"{self._base}/tables/name/{encoded}",
            params={"fields": "id,fullyQualifiedName,extension"},
            timeout=self._timeout,
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()

    def upsert_table(
        self,
        *,
        name: str,
        schema_fqn: str,
        columns: list[dict] | None = None,
        description: str | None = None,
        custom_properties: dict[str, Any] | None = None,
    ) -> str:
        """Create or update a Table entity. Returns the OpenMetadata entity ID."""
        payload: dict[str, Any] = {
            "name": name,
            "databaseSchema": {"fullyQualifiedName": schema_fqn},
            "columns": columns or [],
        }
        if description:
            payload["description"] = description
        if custom_properties:
            payload["extension"] = custom_properties

        resp = self._session.put(
            f"{self._base}/tables",
            json=payload,
            timeout=self._timeout,
        )
        resp.raise_for_status()
        return str(resp.json()["id"])

    # ------------------------------------------------------------------
    # Lineage
    # ------------------------------------------------------------------

    def add_lineage(
        self,
        from_fqn: str,
        to_fqn: str,
        *,
        column_lineage: list[dict] | None = None,
    ) -> None:
        """Add or update a lineage edge between two table entities.

        *column_lineage* is a list of dicts::

            {"fromColumns": ["service.db.schema.table.col"], "toColumn": "service.db.schema.table.col"}
        """
        edge: dict[str, Any] = {
            "fromEntity": {"type": "table", "fullyQualifiedName": from_fqn},
            "toEntity": {"type": "table", "fullyQualifiedName": to_fqn},
        }
        if column_lineage:
            edge["lineageDetails"] = {"columnsLineage": column_lineage}

        resp = self._session.put(
            f"{self._base}/lineage",
            json={"edge": edge},
            timeout=self._timeout,
        )
        resp.raise_for_status()

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def ping(self) -> bool:
        """Return True if the server responds to a health check."""
        try:
            resp = self._session.get(f"{self._base}/system/status", timeout=self._timeout)
            return resp.status_code == 200
        except requests.RequestException:
            return False
