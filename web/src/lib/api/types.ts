/**
 * Standard API response envelope.
 * All API endpoints return this shape — consistent with REST/JSON:API conventions.
 */
export interface ApiResponse<T> {
  data: T;
  source: "databricks" | "cache" | "fallback";
  cachedAt?: string;
  warning?: string;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  error: string;
  source?: string;
}

export interface ApiHealthResponse {
  status: "ok" | "error";
  databricks: boolean;
  sql: {
    live: boolean;
    configured: boolean;
    environment: string;
    host: string | null;
    catalog: string | null;
    schema: string | null;
    warehouseLabel: string | null;
  };
  cache: {
    entries: number;
    oldestAge: number | null;
    newestAge: number | null;
    cacheOnly: boolean;
    ttlSeconds: number;
    fileCount: number;
    sourceCount: number;
    sources: string[];
    coverageFrom: string | null;
    coverageTo: string | null;
  };
  timestamp: string;
}

export interface CacheStatusResponse {
  cache: {
    entries: number;
    oldestAge: number | null;
    newestAge: number | null;
    cacheOnly: boolean;
    ttlSeconds: number;
    fileCount: number;
    sourceCount: number;
    sources: string[];
    coverageFrom: string | null;
    coverageTo: string | null;
  };
}

export interface CacheRefreshResponse {
  message: string;
  dateRange: { from: string; to: string };
  results: Record<string, string>;
  refreshedAt: string;
}

export interface CacheClearResponse {
  message: string;
  endpoint: string;
  cleared: number;
}

export interface SettingsResponse {
  settings: {
    databricksHost: string;
    databricksToken: string;
    databricksWarehouseId: string;
    databricksCatalog: string;
    databricksSchema: string;
    databricksEnvironment: string;
    cacheTtlSeconds: number;
    cacheOnly: boolean;
    tokenSet: boolean;
  };
  message?: string;
}

export interface SettingsUpdateRequest {
  databricksHost?: string;
  databricksToken?: string;
  databricksWarehouseId?: string;
  databricksCatalog?: string;
  databricksSchema?: string;
  databricksEnvironment?: string;
  cacheTtlSeconds?: number;
  cacheOnly?: boolean;
}
