import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type z } from "zod";

export function useLeadActivities(leadId: number | null) {
  return useQuery({
    queryKey: ['/api/leads', leadId, 'activities'],
    enabled: !!leadId,
    queryFn: async () => {
      const url = buildUrl(api.leads.activities.list.path, { id: leadId! });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch activities");
      return await res.json() as Array<{
        id: number;
        leadId: number;
        userId: number | null;
        type: string;
        content: string | null;
        createdAt: string | null;
        username?: string;
      }>;
    },
  });
}

export function useCreateLeadActivity(leadId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.leads.activities.create.input>) => {
      const url = buildUrl(api.leads.activities.create.path, { id: leadId });
      const res = await fetch(url, {
        method: api.leads.activities.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to add note" }));
        throw new Error(err.message || "Failed to add note");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads', leadId, 'activities'] });
    },
  });
}
