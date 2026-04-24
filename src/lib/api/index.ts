export {
  fetchPipelineRuns,
  fetchDataQualityChecks,
  fetchLineageHops,
  fetchLineageEntities,
  fetchLineageAttributes,
  fetchHealth,
  fetchCacheStatus,
  refreshCache,
  clearCache,
  fetchSettings,
  updateSettings,
  seedDemoData,
  ApiClientError,
} from "./client";

export function isNoDataError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; message?: string };
  return e.status === 503 || e.status === 502 ||
    (typeof e.message === "string" && e.message.toLowerCase().includes("no cached data"));
}
export type { ApiResponse, ApiError, ApiHealthResponse, CacheStatusResponse, CacheRefreshResponse, CacheClearResponse, SettingsResponse, SettingsUpdateRequest } from "./types";
