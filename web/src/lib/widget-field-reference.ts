export type FieldValueEntry = { value: string; label: string };
export type FieldReference = { field: string; label: string; values: FieldValueEntry[] };

// Static defaults — merged with or overridden by MDCF data from /api/field-values.
export const STATIC_FIELD_REFERENCES: FieldReference[] = [
  {
    field: "run_status",
    label: "Run Status",
    values: [
      { value: "SUCCESS", label: "Success" },
      { value: "WARNING", label: "Warning" },
      { value: "FAILED",  label: "Failed" },
    ],
  },
  {
    field: "check_status",
    label: "Check Status",
    values: [
      { value: "PASS",    label: "Pass" },
      { value: "FAIL",    label: "Fail" },
      { value: "SUCCESS", label: "Success" },
      { value: "WARNING", label: "Warning" },
      { value: "FAILED",  label: "Failed" },
    ],
  },
  {
    field: "hop_kind",
    label: "Hop Kind",
    values: [
      { value: "DIRECT",  label: "Direct" },
      { value: "DERIVED", label: "Derived" },
      { value: "FILE",    label: "File" },
      { value: "LOOKUP",  label: "Lookup" },
    ],
  },
  {
    field: "source_type",
    label: "Source Type",
    values: [
      { value: "DATASET", label: "Dataset" },
      { value: "FILE",    label: "File" },
    ],
  },
  {
    field: "target_type",
    label: "Target Type",
    values: [
      { value: "DATASET", label: "Dataset" },
    ],
  },
];

export function mergeFieldReferences(
  base: FieldReference[],
  overrides: FieldReference[]
): FieldReference[] {
  const map = new Map(base.map((r) => [r.field, { ...r }]));
  for (const override of overrides) {
    const existing = map.get(override.field);
    if (existing) {
      // Merge values: override entries win; unknown entries from base are kept.
      const seen = new Set(override.values.map((v) => v.value));
      existing.values = [
        ...override.values,
        ...existing.values.filter((v) => !seen.has(v.value)),
      ];
      existing.label = override.label || existing.label;
    } else {
      map.set(override.field, override);
    }
  }
  return [...map.values()];
}

export function getFieldValues(field: string, refs: FieldReference[]): FieldValueEntry[] {
  return refs.find((r) => r.field === field)?.values ?? [];
}
