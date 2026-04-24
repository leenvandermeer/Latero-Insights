"use client";

import { useQuery } from "@tanstack/react-query";
import { STATIC_FIELD_REFERENCES, mergeFieldReferences, getFieldValues, type FieldReference, type FieldValueEntry } from "@/lib/widget-field-reference";
import type { ApiResponse } from "@/lib/api";

async function fetchFieldValues(): Promise<ApiResponse<FieldReference[]>> {
  const res = await fetch("/api/field-values");
  if (!res.ok) throw new Error("Failed to fetch field values");
  return res.json();
}

export function useFieldValues() {
  const { data } = useQuery<ApiResponse<FieldReference[]>>({
    queryKey: ["field-values"],
    queryFn: fetchFieldValues,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const refs: FieldReference[] = data?.data
    ? mergeFieldReferences(STATIC_FIELD_REFERENCES, data.data)
    : STATIC_FIELD_REFERENCES;

  return {
    refs,
    getValues: (field: string): FieldValueEntry[] => getFieldValues(field, refs),
  };
}
