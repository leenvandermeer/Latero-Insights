export {
  fetchPipelineRuns,
  fetchDataQualityChecks,
  fetchEntityQuality,
  fetchLineageHops,
  fetchLineageEntities,
  fetchLineageAttributes,
  fetchInstallations,
  fetchHealth,
  fetchCacheStatus,
  refreshCache,
  clearCache,
  fetchSettings,
  updateSettings,
  seedDemoData,
  // V2
  fetchRuns,
  fetchRunDetail,
  fetchEntities,
  fetchEntityDetail,
  fetchEntityRuns,
  fetchDataProducts,
  fetchEstateHealth,
  ApiClientError,
} from "./client";

export function isNoDataError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; message?: string };
  return e.status === 503 || e.status === 502 ||
    (typeof e.message === "string" && e.message.toLowerCase().includes("no cached data"));
}
export type { ApiResponse, ApiError, ApiHealthResponse, CacheStatusResponse, CacheRefreshResponse, CacheClearResponse, SettingsResponse, SettingsUpdateRequest } from "./types";
export {
  listDataProducts,
  getDataProduct,
  createDataProduct,
  updateDataProduct,
  deprecateDataProduct,
  undeprecateDataProduct,
  deleteDataProduct,
} from "./data-products";
export type {
  DataProduct,
  DataProductSla,
  ListDataProductsOptions,
  CreateDataProductInput,
  UpdateDataProductInput,
} from "./data-products";
export {
  listIncidents,
  getIncident,
  createIncident,
  updateIncident,
  addIncidentStep,
  addIncidentEvidence,
} from "./incidents";
export type {
  Incident,
  IncidentDetail,
  IncidentStep,
  IncidentEvidence,
  IncidentSeverity,
  IncidentStatus,
  IncidentSourceType,
  ListIncidentsOptions,
  CreateIncidentInput,
  UpdateIncidentInput,
} from "./incidents";
export {
  listBusinessOutputs,
  createBusinessOutput,
  getProductBusinessOutputs,
  linkBusinessOutput,
  unlinkBusinessOutput,
  getEntityImpact,
} from "./business-outputs";
export type {
  BusinessOutput,
  BusinessOutputType,
  BusinessOutputCriticality,
  CreateBusinessOutputInput,
  ListBusinessOutputsOptions,
} from "./business-outputs";
export {
  listGlossaryTerms,
  getGlossaryTerm,
  createGlossaryTerm,
  updateGlossaryTerm,
  deleteGlossaryTerm,
  getGlossaryConflicts,
} from "./glossary";
export type {
  GlossaryTerm,
  GlossaryTermDetail,
  GlossaryDatasetLink,
  GlossaryConflict,
  CreateGlossaryTermInput,
  UpdateGlossaryTermInput,
} from "./glossary";
