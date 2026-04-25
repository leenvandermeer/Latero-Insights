"""Latero → OpenMetadata connector.

Syncs lineage_entities_current and lineage_attributes_current to an
OpenMetadata instance via the OpenMetadata REST API.
"""

from latero.connectors.openmetadata.client import OpenMetadataClient
from latero.connectors.openmetadata.sync import sync_from_spark

__all__ = ["OpenMetadataClient", "sync_from_spark"]
