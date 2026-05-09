"use client";

import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listPolicies,
  getComplianceMatrix,
  createPolicy,
  updatePolicy,
  deletePolicy,
  runAllCompliance,
  runProductCompliance,
  listPolicyPacks,
  createPolicyPack,
  updatePolicyPack,
  deletePolicyPack,
} from "@/lib/api/policies";
import type { Policy, PolicyPack, ComplianceMatrix } from "@/lib/api/policies";

export type { Policy, PolicyPack, ComplianceMatrix };

export function usePolicies() {
  return useQuery({
    queryKey: ["policies"],
    queryFn: listPolicies,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useComplianceMatrix() {
  return useQuery({
    queryKey: ["compliance"],
    queryFn: getComplianceMatrix,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPolicy,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policies"] });
      qc.invalidateQueries({ queryKey: ["compliance"] });
    },
  });
}

export function useUpdatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Parameters<typeof updatePolicy>[1]) =>
      updatePolicy(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policies"] });
      qc.invalidateQueries({ queryKey: ["compliance"] });
    },
  });
}

export function useDeletePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePolicy,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policies"] });
      qc.invalidateQueries({ queryKey: ["compliance"] });
    },
  });
}

export function usePolicyPacks() {
  return useQuery({
    queryKey: ["policy-packs"],
    queryFn: listPolicyPacks,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCreatePolicyPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPolicyPack,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policy-packs"] });
      qc.invalidateQueries({ queryKey: ["policies"] });
    },
  });
}

export function useUpdatePolicyPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Parameters<typeof updatePolicyPack>[1]) =>
      updatePolicyPack(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policy-packs"] });
      qc.invalidateQueries({ queryKey: ["policies"] });
    },
  });
}

export function useDeletePolicyPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePolicyPack,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policy-packs"] });
      qc.invalidateQueries({ queryKey: ["policies"] });
      qc.invalidateQueries({ queryKey: ["compliance"] });
    },
  });
}

export function useRunAllCompliance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runAllCompliance,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compliance"] }),
  });
}

export type VerdictValue = "pass" | "fail" | "exception" | "unknown";

/**
 * Manages optimistic per-cell verdict overrides and runs single-cell checks.
 */
export function useCellRunner() {
  const [runningCells, setRunningCells] = useState<Set<string>>(new Set());
  const [localVerdicts, setLocalVerdicts] = useState<Map<string, VerdictValue>>(new Map());

  const runCell = useCallback(async (policyId: string, productId: string) => {
    const key = `${policyId}:${productId}`;
    setRunningCells((prev) => new Set(prev).add(key));
    try {
      const verdict = await runProductCompliance(productId, policyId);
      setLocalVerdicts((prev) => new Map(prev).set(key, verdict.verdict as VerdictValue));
    } catch {
      // keep previous verdict on error
    } finally {
      setRunningCells((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  }, []);

  const resetLocalVerdicts = useCallback(() => setLocalVerdicts(new Map()), []);

  return { runningCells, localVerdicts, runCell, resetLocalVerdicts };
}
