import { useQuery } from "@tanstack/react-query";
import { type ActivitySummary } from "@shared/routes";

export type ReportPeriod = 'today' | 'week' | 'month';

export function useMyReport(period: ReportPeriod) {
  return useQuery({
    queryKey: ['/api/reports/me', period],
    queryFn: async () => {
      const res = await fetch(`/api/reports/me?period=${period}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch report");
      return await res.json() as ActivitySummary;
    },
  });
}

export function useUserReport(userId: number | null, period: ReportPeriod) {
  return useQuery({
    queryKey: ['/api/reports/user', userId, period],
    queryFn: async () => {
      if (!userId) return null;
      const res = await fetch(`/api/reports/user/${userId}?period=${period}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user report");
      return await res.json() as ActivitySummary;
    },
    enabled: !!userId,
  });
}

export function useMyUsers() {
  return useQuery({
    queryKey: ['/api/reports/my-users'],
    queryFn: async () => {
      const res = await fetch('/api/reports/my-users', { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return await res.json() as Array<{ id: number; username: string; role: string; managerId: number | null }>;
    },
  });
}

// ─── ADD THESE to your existing use-reports.ts hook file ───
// (keep all existing exports, just add these two new hooks)

// Fetches leads worked by a specific user in a period (for Dashboard Team Activity)
export function useUserLeads(userId: number | null, period: ReportPeriod) {
  return useQuery({
    queryKey: ['/api/reports/user', userId, 'leads', period],
    queryFn: async () => {
      if (!userId) return [];
      const res = await fetch(`/api/reports/user/${userId}/leads?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch user leads');
      return res.json();
    },
    enabled: !!userId,
  });
}

// Fetches individual activity records filtered by type (for My Report drill-down)
export function useActivityList(userId: number | null, activityType: string, period: ReportPeriod) {
  return useQuery({
    queryKey: ['/api/reports/activities', userId, activityType, period],
    queryFn: async () => {
      const params = new URLSearchParams({ period, type: activityType });
      if (userId) params.set('userId', String(userId));
      const res = await fetch(`/api/reports/activities?${params}`);
      if (!res.ok) throw new Error('Failed to fetch activities');
      return res.json();
    },
    enabled: !!activityType,
  });
}