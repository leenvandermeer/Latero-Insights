import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SharedWidgetDef } from "@/types/dashboard";

const QUERY_KEY = ["shared-widgets"];

export function useSharedWidgets() {
  return useQuery<SharedWidgetDef[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/widgets/shared");
      if (!res.ok) return [];
      return res.json() as Promise<SharedWidgetDef[]>;
    },
    staleTime: 60_000,
  });
}

export function usePublishWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (widget: Omit<SharedWidgetDef, "id" | "publishedAt">) => {
      const res = await fetch("/api/widgets/shared", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(widget),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? "Publish failed");
      }
      return res.json() as Promise<SharedWidgetDef>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useWithdrawWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/widgets/shared/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Withdraw failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
