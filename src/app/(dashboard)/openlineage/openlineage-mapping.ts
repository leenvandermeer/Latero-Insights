import type { LineageHop } from "@/lib/adapters/types";
import { isDataFlowHop } from "@/lib/lineage-hop-kind";

type DatasetDirection = "source" | "target";

type OpenLineageInputField = {
  namespace: string;
  name: string;
  field: string;
  transformations: Array<{ type: "DIRECT"; subtype: "IDENTITY" }>;
};

type OpenLineageColumnLineageField = {
  name: string;
  inputFields: OpenLineageInputField[];
};

export type OpenLineageDataset = {
  key: string;
  namespace: string;
  name: string;
  label: string;
  ref: string;
  type: string;
  facets: Record<string, unknown>;
};

interface RunEventLike {
  run_id: string;
  job_name: string;
  timestamp: string;
  hops: LineageHop[];
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function getHopField(hop: LineageHop, direction: DatasetDirection, field: "entity" | "ref" | "type" | "attribute"): string {
  if (direction === "source") {
    if (field === "entity") return normalize(hop.source_entity);
    if (field === "ref") return normalize(hop.source_ref);
    if (field === "type") return normalize(hop.source_type);
    return normalize(hop.source_attribute);
  }
  if (field === "entity") return normalize(hop.target_entity);
  if (field === "ref") return normalize(hop.target_ref);
  if (field === "type") return normalize(hop.target_type);
  return normalize(hop.target_attribute);
}

function parseDatasetRef(ref: string, attribute: string): { namespace: string; refName: string } {
  const parts = ref.split(".");
  if (attribute && parts.length >= 3) {
    return {
      namespace: parts.slice(0, -2).join("."),
      refName: parts[parts.length - 2] ?? ref,
    };
  }
  if (parts.length >= 2) {
    return {
      namespace: parts.slice(0, -1).join("."),
      refName: parts[parts.length - 1] ?? ref,
    };
  }
  return { namespace: ref, refName: ref };
}

function isMaterialDatasetHop(hop: LineageHop): boolean {
  if (!isDataFlowHop(hop)) return false;

  const sourceRef = normalize(hop.source_ref);
  const targetRef = normalize(hop.target_ref);
  const sourceAttr = normalize(hop.source_attribute);
  const targetAttr = normalize(hop.target_attribute);

  if (!sourceRef || !targetRef) return true;
  if (sourceAttr || targetAttr) return true;
  return sourceRef !== targetRef;
}

function buildDatasetIdentity(hop: LineageHop, direction: DatasetDirection): Omit<OpenLineageDataset, "key" | "facets"> {
  const ref = getHopField(hop, direction, "ref");
  const entity = getHopField(hop, direction, "entity");
  const type = getHopField(hop, direction, "type");
  const attribute = getHopField(hop, direction, "attribute");

  if (!ref) {
    const fallbackName = entity || "unknown";
    return {
      namespace: "latero",
      name: fallbackName,
      label: fallbackName,
      ref: fallbackName,
      type,
    };
  }

  const { namespace, refName } = parseDatasetRef(ref, attribute);
  const name = entity || refName || ref;
  return {
    namespace: namespace || "latero",
    name,
    label: name,
    ref,
    type,
  };
}

function buildInputColumnFields(hops: LineageHop[], dataset: Omit<OpenLineageDataset, "key" | "facets">) {
  const seen = new Set<string>();
  const fields: Array<{ name: string; transformationType: "DIRECT" }> = [];

  for (const hop of hops) {
    const attr = normalize(hop.source_attribute);
    if (!attr) continue;
    const source = buildDatasetIdentity(hop, "source");
    if (source.namespace !== dataset.namespace || source.name !== dataset.name) continue;
    if (seen.has(attr)) continue;
    seen.add(attr);
    fields.push({ name: attr, transformationType: "DIRECT" });
  }

  return fields;
}

function buildOutputColumnFields(hops: LineageHop[], dataset: Omit<OpenLineageDataset, "key" | "facets">): OpenLineageColumnLineageField[] {
  const byTargetField = new Map<string, OpenLineageColumnLineageField>();

  for (const hop of hops) {
    const targetAttr = normalize(hop.target_attribute);
    const sourceAttr = normalize(hop.source_attribute);
    if (!targetAttr || !sourceAttr) continue;

    const target = buildDatasetIdentity(hop, "target");
    if (target.namespace !== dataset.namespace || target.name !== dataset.name) continue;

    const source = buildDatasetIdentity(hop, "source");
    const field = byTargetField.get(targetAttr) ?? { name: targetAttr, inputFields: [] };
    const inputKey = `${source.namespace}::${source.name}::${sourceAttr}`;

    if (!field.inputFields.some((input) => `${input.namespace}::${input.name}::${input.field}` === inputKey)) {
      field.inputFields.push({
        namespace: source.namespace,
        name: source.name,
        field: sourceAttr,
        transformations: [{ type: "DIRECT", subtype: "IDENTITY" }],
      });
    }

    byTargetField.set(targetAttr, field);
  }

  return Array.from(byTargetField.values());
}

export function buildOpenLineageDatasets(hops: LineageHop[], direction: DatasetDirection): OpenLineageDataset[] {
  const datasets = new Map<string, OpenLineageDataset>();
  const materialHops = hops.filter(isMaterialDatasetHop);

  for (const hop of materialHops) {
    const dataset = buildDatasetIdentity(hop, direction);
    const key = `${dataset.namespace}::${dataset.name}`;
    if (datasets.has(key)) continue;

    const facets =
      direction === "source"
        ? { columnLineage: { fields: buildInputColumnFields(materialHops, dataset) } }
        : { columnLineage: { fields: buildOutputColumnFields(materialHops, dataset) } };

    datasets.set(key, { ...dataset, key, facets });
  }

  return Array.from(datasets.values());
}

export function toOpenLineageFormat(event: RunEventLike) {
  const inputs = buildOpenLineageDatasets(event.hops, "source").map(({ namespace, name, facets }) => ({
    namespace,
    name,
    facets,
  }));

  const outputs = buildOpenLineageDatasets(event.hops, "target").map(({ namespace, name, facets }) => ({
    namespace,
    name,
    facets,
  }));

  return {
    eventType: "COMPLETE",
    eventTime: event.timestamp,
    run: {
      runId: event.run_id,
      facets: {
        processing_engine: {
          name: "latero-meta-data-controle-framework",
          version: "1.0",
        },
      },
    },
    job: {
      namespace: "latero",
      name: event.job_name,
    },
    inputs,
    outputs,
  };
}
