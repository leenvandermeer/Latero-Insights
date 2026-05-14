/**
 * React Query hooks for admin dashboard
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AdminInstallation,
  AdminHealthMetrics,
  AdminAuditLog,
  AdminUser,
  AdminUserProvisionResult,
  AdminUserUpdateResult,
  AdminPasswordResetResult,
  AdminUserDeactivationResult,
  AdminAuthConfig,
  AdminSsoTestResult,
} from "@/types/admin";

async function adminRequest(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Admin API request failed: ${res.status}`);
  }
  return res;
}

// Installations
export function useAdminInstallations(skip: number = 0, take: number = 50) {
  return useQuery({
    queryKey: ["admin", "installations", skip, take],
    queryFn: async () => {
      const res = await adminRequest(`/api/v1/admin/installations?skip=${skip}&take=${take}`);
      return res.json() as Promise<{ installations: AdminInstallation[] }>;
    },
  });
}

export function useAdminInstallation(installationId: string) {
  return useQuery({
    queryKey: ["admin", "installation", installationId],
    queryFn: async () => {
      const res = await adminRequest(`/api/v1/admin/installations/${installationId}`);
      return res.json() as Promise<{
        installation: AdminInstallation;
        health_timeline: any[];
      }>;
    },
    enabled: !!installationId,
  });
}

export function useCreateInstallation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      label: string;
      environment?: string;
      tier?: string;
      contact_email?: string;
    }) => {
      const res = await adminRequest("/api/v1/admin/installations", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "installations"] });
    },
  });
}

export function useUpdateInstallation(installationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<AdminInstallation>) => {
      const res = await adminRequest(`/api/v1/admin/installations/${installationId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "installation", installationId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "installations"] });
    },
  });
}

// Health
export function useAdminHealth() {
  return useQuery({
    queryKey: ["admin", "health"],
    queryFn: async () => {
      const res = await adminRequest("/api/v1/admin/health");
      return res.json() as Promise<AdminHealthMetrics>;
    },
    refetchInterval: 30000, // Auto-refresh every 30s
  });
}

// Audit logs
export function useAdminAuditLog(limit: number = 100, offset: number = 0) {
  return useQuery({
    queryKey: ["admin", "audit", limit, offset],
    queryFn: async () => {
      const res = await adminRequest(`/api/v1/admin/audit?limit=${limit}&offset=${offset}`);
      return res.json() as Promise<{ logs: AdminAuditLog[] }>;
    },
  });
}

// Users
export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await adminRequest("/api/v1/admin/users");
      return res.json() as Promise<{ users: AdminUser[]; count: number }>;
    },
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      email: string;
      password?: string;
      generate_password?: boolean;
      installations: { installation_id: string; role: "member" | "admin" }[];
      is_admin?: boolean;
    }) => {
      const res = await adminRequest("/api/v1/admin/users", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return res.json() as Promise<AdminUserProvisionResult>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "installations"] });
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      userId: string;
      installations?: { installation_id: string; role: "member" | "admin" }[];
      is_admin?: boolean;
    }) => {
      const { userId, ...payload } = data;
      const res = await adminRequest(`/api/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return res.json() as Promise<AdminUserUpdateResult>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "installations"] });
    },
  });
}

export function useResetAdminUserPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string; password?: string }) => {
      const res = await adminRequest(`/api/v1/admin/users/${encodeURIComponent(data.userId)}/reset-password`, {
        method: "POST",
        body: JSON.stringify(data.password ? { password: data.password } : {}),
      });
      return res.json() as Promise<AdminPasswordResetResult>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useDeactivateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string }) => {
      const res = await adminRequest(`/api/v1/admin/users/${encodeURIComponent(data.userId)}`, {
        method: "DELETE",
      });
      return res.json() as Promise<AdminUserDeactivationResult>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "installations"] });
    },
  });
}

export function useResetAdmin2FA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string }) => {
      const res = await adminRequest(
        `/api/v1/admin/users/${encodeURIComponent(data.userId)}/2fa`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to reset 2FA");
      }
      return res.json() as Promise<{ reset: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

// Auth config
export function useAdminAuthConfig(installationId: string) {
  return useQuery({
    queryKey: ["admin", "auth-config", installationId],
    queryFn: async () => {
      const res = await adminRequest(
        `/api/v1/admin/installations/${encodeURIComponent(installationId)}/auth-config`,
      );
      return res.json() as Promise<AdminAuthConfig>;
    },
    enabled: !!installationId,
  });
}

export function useUpdateAdminAuthConfig(installationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Partial<Pick<AdminAuthConfig, "auth_policy" | "sso_config">>,
    ) => {
      const res = await adminRequest(
        `/api/v1/admin/installations/${encodeURIComponent(installationId)}/auth-config`,
        { method: "PUT", body: JSON.stringify(data) },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "auth-config", installationId] });
    },
  });
}

export function useTestSsoConnection(installationId: string) {
  return useMutation({
    mutationFn: async (issuer: string) => {
      const res = await fetch(
        `/api/v1/admin/installations/${encodeURIComponent(installationId)}/auth-config/test`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issuer }),
        },
      );
      return res.json() as Promise<AdminSsoTestResult>;
    },
  });
}
