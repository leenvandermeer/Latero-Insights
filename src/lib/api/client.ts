import type { PipelineRun, DataQualityCheck, LineageHop, LineageEntity, LineageAttribute } from "@/lib/adapters/types";
import type {
  ApiResponse,
  ApiError,
  ApiHealthResponse,
  CacheStatusResponse,
  CacheRefreshResponse,
  CacheClearResponse,
  SettingsResponse,
  SettingsUpdateRequest,
} from "./types";

/**
 * Typed API client for Latero Meta Insights.
 *
 * Pattern: Repository/Gateway pattern — encapsulates all HTTP communication
 * with the BFF (Backend-for-Frontend) API routes.
 *
 * All methods throw ApiClientError on non-2xx responses.
 */

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: ApiError,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface DateRangeParams {
  from: string;
  to: string;
}

const BASE_URL = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let body: ApiError | undefined;
    try {
      body = await res.json();
    } catch {
      // response may not be JSON
    }
    throw new ApiClientError(
      body?.error ?? `API request failed: ${res.status}`,
      res.status,
      body,
    );
  }

  return res.json();
}

function dateParams(range: DateRangeParams): string {
  return `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
}

// ── Data endpoints ──────────────────────────────────────────────

export function fetchPipelineRuns(range: DateRangeParams): Promise<ApiResponse<PipelineRun[]>> {
  return request(`/pipelines${dateParams(range)}`);
}

export function fetchDataQualityChecks(range: DateRangeParams): Promise<ApiResponse<DataQualityCheck[]>> {
  return request(`/quality${dateParams(range)}`);
}

export function fetchLineageHops(range: DateRangeParams): Promise<ApiResponse<LineageHop[]>> {
  return request(`/lineage${dateParams(range)}`);
}

export function fetchLineageEntities(): Promise<ApiResponse<LineageEntity[]>> {
  return request("/lineage/entities");
}

export function fetchLineageAttributes(): Promise<ApiResponse<LineageAttribute[]>> {
  return request("/lineage/attributes");
}

export function fetchCanonicalLineage(): Promise<ApiResponse<LineageHop[]>> {
  return request("/lineage/canonical");
}

// ── Health & cache endpoints ────────────────────────────────────

export function fetchHealth(): Promise<ApiHealthResponse> {
  return request("/health");
}

export function fetchCacheStatus(): Promise<CacheStatusResponse> {
  return request("/cache");
}

export function refreshCache(
  range: DateRangeParams,
  endpoint?: string,
): Promise<CacheRefreshResponse> {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  if (endpoint) params.set("endpoint", endpoint);
  return request(`/cache/refresh?${params}`, { method: "POST" });
}

export function clearCache(endpoint?: string): Promise<CacheClearResponse> {
  const params = endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : "";
  return request(`/cache${params}`, { method: "DELETE" });
}

// ── Settings endpoints ──────────────────────────────────────────

export function fetchSettings(): Promise<SettingsResponse> {
  return request("/settings");
}

export function updateSettings(settings: SettingsUpdateRequest): Promise<SettingsResponse> {
  return request("/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export function seedDemoData(): Promise<{ seeded: { pipelines: number; quality: number; lineage: number } }> {
  return request("/cache/seed", { method: "POST" });
}
