import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type LeadWithUser } from "@shared/routes";
import { type z } from "zod";

export function useLeads() {
  return useQuery({
    queryKey: [api.leads.list.path],
    queryFn: async () => {
      const res = await fetch(api.leads.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return await res.json() as LeadWithUser[];
    },
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.leads.create.input>) => {
      const res = await fetch(api.leads.create.path, {
        method: api.leads.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create lead");
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.leads.list.path] }),
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & z.infer<typeof api.leads.update.input>) => {
      const url = buildUrl(api.leads.update.path, { id });
      const res = await fetch(url, {
        method: api.leads.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update lead");
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.leads.list.path] }),
  });
}

export function useBulkUpdateLeads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.leads.bulkUpdate.input>) => {
      const res = await fetch(api.leads.bulkUpdate.path, {
        method: api.leads.bulkUpdate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Bulk update failed" }));
        throw new Error(err.message || "Bulk update failed");
      }
      return await res.json() as { count: number };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.leads.list.path] }),
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.leads.delete.path, { id });
      const res = await fetch(url, {
        method: api.leads.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete lead");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.leads.list.path] }),
  });
}

export function useUploadCsv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(api.leads.uploadCsv.path, {
        method: api.leads.uploadCsv.method,
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to upload CSV");
      return api.leads.uploadCsv.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.leads.list.path] }),
  });
}
