import { useQuery } from "@tanstack/react-query";
import { type ActivitySummary } from "@shared/routes";

export type ReportPeriod = 'today' | 'week' | 'month' | 'custom';

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

function buildParams(period: ReportPeriod, range?: DateRange): string {
  if (period === 'custom' && range?.from && range?.to) {
    return `from=${range.from}&to=${range.to}`;
  }
  return `period=${period}`;
}

export function useMyReport(period: ReportPeriod, range?: DateRange) {
  return useQuery({
    queryKey: ['/api/reports/me', period, range],
    enabled: period !== 'custom' || (!!range?.from && !!range?.to),
    queryFn: async () => {
      const res = await fetch(`/api/reports/me?${buildParams(period, range)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch report");
      return await res.json() as ActivitySummary;
    },
  });
}

export function useUserReport(userId: number | null, period: ReportPeriod, range?: DateRange) {
  return useQuery({
    queryKey: ['/api/reports/user', userId, period, range],
    enabled: !!userId && (period !== 'custom' || (!!range?.from && !!range?.to)),
    queryFn: async () => {
      if (!userId) return null;
      const res = await fetch(`/api/reports/user/${userId}?${buildParams(period, range)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user report");
      return await res.json() as ActivitySummary;
    },
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

export function useUserLeads(userId: number | null, period: ReportPeriod, range?: DateRange) {
  return useQuery({
    queryKey: ['/api/reports/user', userId, 'leads', period, range],
    enabled: !!userId && (period !== 'custom' || (!!range?.from && !!range?.to)),
    queryFn: async () => {
      if (!userId) return [];
      const res = await fetch(`/api/reports/user/${userId}/leads?${buildParams(period, range)}`);
      if (!res.ok) throw new Error('Failed to fetch user leads');
      return res.json();
    },
  });
}

export function useActivityList(userId: number | null, activityType: string, period: ReportPeriod, range?: DateRange) {
  return useQuery({
    queryKey: ['/api/reports/activities', userId, activityType, period, range],
    enabled: !!activityType && (period !== 'custom' || (!!range?.from && !!range?.to)),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period === 'custom' && range?.from && range?.to) {
        params.set('from', range.from);
        params.set('to', range.to);
      } else {
        params.set('period', period);
      }
      params.set('type', activityType);
      if (userId) params.set('userId', String(userId));
      const res = await fetch(`/api/reports/activities?${params}`);
      if (!res.ok) throw new Error('Failed to fetch activities');
      return res.json();
    },
  });
}