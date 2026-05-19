import { useState, useEffect } from "react";
import { useMyReport, useUserReport, useMyUsers, useActivityList, type ReportPeriod } from "@/hooks/use-reports";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Phone, MessageCircle, MessageSquare, Plus, ArrowRightLeft,
  StickyNote, CalendarClock, Activity, Loader2, TrendingUp, Users,
  ChevronDown, ChevronRight, X, BarChart3, AlertTriangle,
  CheckCircle2, UserCheck, Trophy, ArrowUp, ArrowDown, Minus
} from "lucide-react";

type Period = { label: string; value: ReportPeriod };

const PERIODS: Period[] = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
];

type StatKey = 'calls' | 'whatsapp' | 'sms' | 'leadsCreated' | 'statusChanges' | 'notesAdded' | 'followUpsSet';

const STAT_DEFS: Array<{
  key: StatKey;
  label: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
  activityType: string;
}> = [
  { key: 'calls', label: "Calls Made", icon: Phone, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", activityType: 'call' },
  { key: 'whatsapp', label: "WhatsApp Sent", icon: MessageCircle, color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/20", activityType: 'whatsapp' },
  { key: 'sms', label: "SMS Sent", icon: MessageSquare, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", activityType: 'sms' },
  { key: 'leadsCreated', label: "Leads Created", icon: Plus, color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20", activityType: 'created' },
  { key: 'statusChanges', label: "Status Changes", icon: ArrowRightLeft, color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20", activityType: 'status_change' },
  { key: 'notesAdded', label: "Notes Added", icon: StickyNote, color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", activityType: 'note' },
  { key: 'followUpsSet', label: "Follow-ups Set", icon: CalendarClock, color: "text-sky-400", bg: "bg-sky-400/10", border: "border-sky-400/20", activityType: 'followup' },
];

// ── KPI types ─────────────────────────────────────────────────────────────────
interface UserKPI {
  userId: number;
  username: string;
  calls: number;
  willRegister: number;   // leads with status "Will Register"
  converted: number;      // leads with status "Converted"
  missedFollowups: number; // stamped missed days count
  totalActivities: number;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useUserSummary(userId: number | null, period: ReportPeriod) {
  return useQuery({
    queryKey: ["/api/reports/user", userId, period],
    enabled: userId !== null,
    queryFn: async () => {
      const res = await fetch(`/api/reports/user/${userId}?period=${period}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user report");
      return res.json();
    },
  });
}

function useUserLeads(userId: number | null, period: ReportPeriod) {
  return useQuery({
    queryKey: ["/api/reports/user", userId, period, "leads"],
    enabled: userId !== null,
    queryFn: async () => {
      const res = await fetch(`/api/reports/user/${userId}/leads?period=${period}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user leads");
      return res.json();
    },
  });
}

function useMissedFollowupDays(userId: number | null) {
  return useQuery({
    queryKey: ["/api/missed-followup-days", userId],
    enabled: userId !== null,
    queryFn: async () => {
      const res = await fetch(`/api/missed-followup-days?userId=${userId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ missedDate: string }[]>;
    },
  });
}

// ── Activity List ─────────────────────────────────────────────────────────────
function ActivityList({ userId, activityType, period, color, label, onClose }: {
  userId: number | null;
  activityType: string;
  period: ReportPeriod;
  color: string;
  label: string;
  onClose: () => void;
}) {
  const { data: activities, isLoading } = useActivityList(userId, activityType, period);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="rounded-2xl border border-white/8 bg-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between">
        <span className={`text-sm font-medium ${color}`}>{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {isLoading ? "..." : `${activities?.length ?? 0} records`}
          </span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !activities || activities.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          No {label.toLowerCase()} in this period
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {activities.map((item: any) => (
            <div key={item.id}>
              <button
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.03] transition-colors"
              >
                {expandedId === item.id
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate block">
                    {item.leadName || "Unknown Lead"}
                  </span>
                  {item.leadCompany && (
                    <span className="text-xs text-muted-foreground">{item.leadCompany}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </button>

              {expandedId === item.id && (
                <div className="px-5 pb-4 pt-2 bg-white/[0.02] border-t border-white/5">
                  {item.content && (
                    <p className="text-sm text-muted-foreground">{item.content}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground/60">
                    {item.leadMobile && <span>{item.leadMobile}</span>}
                    {item.leadStatus && (
                      <span className="capitalize">Status: {item.leadStatus}</span>
                    )}
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stat Grid ─────────────────────────────────────────────────────────────────
function StatGrid({ summary, isLoading, onStatClick, activeStatKey }: {
  summary: any;
  isLoading: boolean;
  onStatClick: (key: StatKey) => void;
  activeStatKey: StatKey | null;
}) {
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {summary && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Activities</p>
            <p className="text-4xl font-display font-bold text-primary">{summary.total}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STAT_DEFS.map((stat) => {
          const isActive = activeStatKey === stat.key;
          return (
            <button
              key={stat.key}
              onClick={() => onStatClick(stat.key)}
              className={`rounded-2xl border ${stat.border} ${stat.bg} p-5 flex flex-col gap-3 text-left transition-all duration-200 ${
                isActive
                  ? 'ring-2 ring-offset-2 ring-offset-background ' + stat.border.replace('border-', 'ring-')
                  : 'hover:brightness-125'
              }`}
            >
              <div className={`h-9 w-9 rounded-xl ${stat.bg} border ${stat.border} flex items-center justify-center`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <p className={`text-3xl font-display font-bold ${stat.color}`}>{summary?.[stat.key] ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {summary && summary.total > 0 && (
        <div className="rounded-2xl border border-white/8 bg-card p-6 space-y-4">
          <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">Activity Breakdown</h2>
          <div className="space-y-3">
            {STAT_DEFS.map((stat) => (
              <div key={stat.key} className="flex items-center gap-3">
                <div className="w-32 text-xs text-muted-foreground shrink-0">{stat.label}</div>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${stat.bg.replace('/10', '/60')}`}
                    style={{ width: summary.total > 0 ? `${((summary[stat.key] ?? 0) / summary.total) * 100}%` : '0%' }}
                  />
                </div>
                <div className={`text-sm font-semibold ${stat.color} w-8 text-right`}>{summary?.[stat.key] ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── KPI Row — loads data for one user ────────────────────────────────────────
function KPIUserRow({
  user,
  period,
  rank,
  maxCalls,
  maxConverted,
  onSelect,
  isSelected,
}: {
  user: { id: number; username: string };
  period: ReportPeriod;
  rank: number;
  maxCalls: number;
  maxConverted: number;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const { data: summary } = useUserSummary(user.id, period);
  const { data: leads = [] } = useUserLeads(user.id, period);
  const { data: missedDays = [] } = useMissedFollowupDays(user.id);

  const calls = summary?.calls ?? 0;
  const willRegister = (leads as any[]).filter((l: any) => l.status === "Will Register").length;
  const converted = (leads as any[]).filter((l: any) => l.status === "Converted").length;

  // Missed follow-up days in the selected period
  const missedFollowups = (() => {
    const now = new Date();
    let from: Date;
    if (period === "today") {
      from = new Date(now); from.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      from = new Date(now); from.setDate(now.getDate() - now.getDay()); from.setHours(0, 0, 0, 0);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return (missedDays as any[]).filter((d: any) => new Date(d.missedDate) >= from).length;
  })();

  const totalActivities = summary?.total ?? 0;
  const rankColors = ["text-yellow-400", "text-slate-300", "text-amber-600"];
  const rankBg = ["bg-yellow-400/10 border-yellow-400/20", "bg-slate-300/10 border-slate-300/20", "bg-amber-600/10 border-amber-600/20"];

  return (
    <tr
      onClick={onSelect}
      className={`border-b border-white/5 cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-white/[0.02]"}`}
    >
      {/* Rank */}
      <td className="px-4 py-3.5 w-12">
        {rank <= 3 ? (
          <div className={`h-7 w-7 rounded-lg border flex items-center justify-center text-xs font-bold ${rankBg[rank - 1] || ""} ${rankColors[rank - 1] || ""}`}>
            {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground/50 pl-1">{rank}</span>
        )}
      </td>

      {/* Name */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {user.username.substring(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium">{user.username}</span>
        </div>
      </td>

      {/* Calls */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-emerald-400">{calls}</span>
          <div className="flex-1 max-w-[60px] h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400/50 rounded-full transition-all duration-500"
              style={{ width: maxCalls > 0 ? `${(calls / maxCalls) * 100}%` : "0%" }}
            />
          </div>
        </div>
      </td>

      {/* Will Register */}
      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-400">
          <UserCheck className="h-3.5 w-3.5" />
          {willRegister}
        </span>
      </td>

      {/* Converted */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-purple-400">{converted}</span>
          <div className="flex-1 max-w-[60px] h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-400/50 rounded-full transition-all duration-500"
              style={{ width: maxConverted > 0 ? `${(converted / maxConverted) * 100}%` : "0%" }}
            />
          </div>
        </div>
      </td>

      {/* Missed Follow-ups */}
      <td className="px-4 py-3.5">
        {missedFollowups > 0 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400">
            <AlertTriangle className="h-3 w-3" />
            {missedFollowups} day{missedFollowups > 1 ? "s" : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            Clean
          </span>
        )}
      </td>

      {/* Total */}
      <td className="px-4 py-3.5 text-right">
        <span className="text-sm font-bold text-foreground/80">{totalActivities}</span>
      </td>
    </tr>
  );
}

// ── KPI Analytics Tab ─────────────────────────────────────────────────────────
function KPITab({ period }: { period: ReportPeriod }) {
  const { data: myUsers, isLoading } = useMyUsers();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<"calls" | "converted" | "total">("calls");

  const teamUsers = myUsers?.filter((u: any) => u.role === "user") ?? [];

  // We need summary data to sort — use a lightweight approach: sort by username initially,
  // users can click column headers to re-sort client side after data loads
  const [userStats, setUserStats] = useState<Map<number, { calls: number; converted: number; total: number }>>(new Map());

  const updateStat = (userId: number, calls: number, converted: number, total: number) => {
    setUserStats(prev => {
      const next = new Map(prev);
      next.set(userId, { calls, converted, total });
      return next;
    });
  };

  const sortedUsers = [...teamUsers].sort((a, b) => {
    const aStats = userStats.get(a.id) ?? { calls: 0, converted: 0, total: 0 };
    const bStats = userStats.get(b.id) ?? { calls: 0, converted: 0, total: 0 };
    return (bStats[sortKey] ?? 0) - (aStats[sortKey] ?? 0);
  });

  const maxCalls = Math.max(...Array.from(userStats.values()).map(s => s.calls), 1);
  const maxConverted = Math.max(...Array.from(userStats.values()).map(s => s.converted), 1);

  const SortBtn = ({ col, label }: { col: "calls" | "converted" | "total"; label: string }) => (
    <button
      onClick={() => setSortKey(col)}
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
        sortKey === col ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {sortKey === col ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3 opacity-30" />}
    </button>
  );

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;

  if (teamUsers.length === 0) return (
    <div className="text-center py-12 text-muted-foreground text-sm rounded-2xl border border-white/8 bg-card">
      <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
      No team members assigned yet.
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Summary header cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
          <p className="text-xs text-muted-foreground">Total Calls</p>
          <p className="text-3xl font-display font-bold text-emerald-400 mt-1">
            {Array.from(userStats.values()).reduce((s, v) => s + v.calls, 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-blue-400/20 bg-blue-400/5 p-5">
          <p className="text-xs text-muted-foreground">Team Members</p>
          <p className="text-3xl font-display font-bold text-blue-400 mt-1">{teamUsers.length}</p>
        </div>
        <div className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-5">
          <p className="text-xs text-muted-foreground">Total Converted</p>
          <p className="text-3xl font-display font-bold text-purple-400 mt-1">
            {Array.from(userStats.values()).reduce((s, v) => s + v.converted, 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <p className="text-xs text-muted-foreground">Total Activities</p>
          <p className="text-3xl font-display font-bold text-primary mt-1">
            {Array.from(userStats.values()).reduce((s, v) => s + v.total, 0)}
          </p>
        </div>
      </div>

      {/* KPI Table */}
      <div className="rounded-2xl border border-white/8 bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">KPI Leaderboard</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Sort by:</span>
            <SortBtn col="calls" label="Calls" />
            <SortBtn col="converted" label="Converted" />
            <SortBtn col="total" label="Total" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-12">#</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-emerald-400" /> Calls</span>
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1"><UserCheck className="h-3 w-3 text-blue-400" /> Will Register</span>
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-purple-400" /> Converted</span>
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-400" /> Missed FU</span>
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user, idx) => (
                <KPIUserRowWithUpdate
                  key={user.id}
                  user={user}
                  period={period}
                  rank={idx + 1}
                  maxCalls={maxCalls}
                  maxConverted={maxConverted}
                  onSelect={() => setSelectedUserId(selectedUserId === user.id ? null : user.id)}
                  isSelected={selectedUserId === user.id}
                  onStatsLoaded={updateStat}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-white/5 text-xs text-muted-foreground">
          Click a row to drill into that member's activity · Missed FU = days with uncleared follow-ups in period
        </div>
      </div>

      {/* Drill-down panel */}
      {selectedUserId && (() => {
        const u = teamUsers.find((u: any) => u.id === selectedUserId);
        return u ? (
          <div className="rounded-2xl border border-white/8 bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {u.username.substring(0, 2).toUpperCase()}
                </div>
                <span className="font-semibold text-sm">{u.username} — Detail</span>
              </div>
              <button onClick={() => setSelectedUserId(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <UserDetailKPI userId={selectedUserId} period={period} />
            </div>
          </div>
        ) : null;
      })()}
    </div>
  );
}

// Wrapper that also reports stats upward for sorting
function KPIUserRowWithUpdate({
  user, period, rank, maxCalls, maxConverted, onSelect, isSelected, onStatsLoaded,
}: {
  user: { id: number; username: string };
  period: ReportPeriod;
  rank: number;
  maxCalls: number;
  maxConverted: number;
  onSelect: () => void;
  isSelected: boolean;
  onStatsLoaded: (userId: number, calls: number, converted: number, total: number) => void;
}) {
  const { data: summary } = useUserSummary(user.id, period);
  const { data: leads = [] } = useUserLeads(user.id, period);
  const { data: missedDays = [] } = useMissedFollowupDays(user.id);

  const calls = summary?.calls ?? 0;
  const converted = (leads as any[]).filter((l: any) => l.status === "Converted").length;
  const willRegister = (leads as any[]).filter((l: any) => l.status === "Will Register").length;
  const totalActivities = summary?.total ?? 0;

  const missedFollowups = (() => {
    const now = new Date();
    let from: Date;
    if (period === "today") { from = new Date(now); from.setHours(0, 0, 0, 0); }
    else if (period === "week") { from = new Date(now); from.setDate(now.getDate() - now.getDay()); from.setHours(0, 0, 0, 0); }
    else { from = new Date(now.getFullYear(), now.getMonth(), 1); }
    return (missedDays as any[]).filter((d: any) => new Date(d.missedDate) >= from).length;
  })();

  // Report stats upward when they load
  useEffect(() => {
    if (summary !== undefined) {
      onStatsLoaded(user.id, calls, converted, totalActivities);
    }
  }, [calls, converted, totalActivities]);

  const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  const rankBg = rank === 1 ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-400"
    : rank === 2 ? "bg-slate-300/10 border-slate-300/20 text-slate-300"
    : rank === 3 ? "bg-amber-600/10 border-amber-600/20 text-amber-600" : "";

  return (
    <tr
      onClick={onSelect}
      className={`border-b border-white/5 cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-white/[0.02]"}`}
    >
      <td className="px-4 py-3.5 w-12">
        {rankEmoji ? (
          <div className={`h-7 w-7 rounded-lg border flex items-center justify-center text-xs font-bold ${rankBg}`}>
            {rankEmoji}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground/50 pl-1">{rank}</span>
        )}
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {user.username.substring(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium">{user.username}</span>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-emerald-400">{calls}</span>
          <div className="flex-1 max-w-[60px] h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400/50 rounded-full transition-all duration-500"
              style={{ width: maxCalls > 0 ? `${(calls / maxCalls) * 100}%` : "0%" }} />
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-400">
          <UserCheck className="h-3.5 w-3.5" />{willRegister}
        </span>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-purple-400">{converted}</span>
          <div className="flex-1 max-w-[60px] h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-purple-400/50 rounded-full transition-all duration-500"
              style={{ width: maxConverted > 0 ? `${(converted / maxConverted) * 100}%` : "0%" }} />
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        {missedFollowups > 0 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400">
            <AlertTriangle className="h-3 w-3" />{missedFollowups} day{missedFollowups > 1 ? "s" : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />Clean
          </span>
        )}
      </td>

      <td className="px-4 py-3.5 text-right">
        <span className="text-sm font-bold text-foreground/80">{totalActivities}</span>
      </td>
    </tr>
  );
}

// ── Drill-down detail for a selected user ────────────────────────────────────
function UserDetailKPI({ userId, period }: { userId: number; period: ReportPeriod }) {
  const { data: summary, isLoading } = useUserSummary(userId, period);
  const { data: leads = [] } = useUserLeads(userId, period);
  const [activeStatKey, setActiveStatKey] = useState<StatKey | null>(null);
  const activeStat = STAT_DEFS.find(s => s.key === activeStatKey);

  const willRegister = (leads as any[]).filter((l: any) => l.status === "Will Register").length;
  const converted = (leads as any[]).filter((l: any) => l.status === "Converted").length;

  return (
    <div className="space-y-4">
      {/* Mini KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Calls</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{summary?.calls ?? 0}</p>
        </div>
        <div className="rounded-xl border border-blue-400/20 bg-blue-400/5 p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Will Register</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{willRegister}</p>
        </div>
        <div className="rounded-xl border border-purple-400/20 bg-purple-400/5 p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Converted</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{converted}</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Activities</p>
          <p className="text-2xl font-bold text-primary mt-1">{summary?.total ?? 0}</p>
        </div>
      </div>

      {/* Clickable activity stats */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        {STAT_DEFS.map((stat) => (
          <button
            key={stat.key}
            onClick={() => setActiveStatKey(prev => prev === stat.key ? null : stat.key)}
            className={`rounded-xl border ${stat.border} ${stat.bg} p-3 flex flex-col gap-1.5 text-left transition-all ${
              activeStatKey === stat.key ? "ring-2 ring-offset-1 ring-offset-background " + stat.border.replace("border-", "ring-") : "hover:brightness-125"
            }`}
          >
            <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
            <p className={`text-xl font-bold ${stat.color}`}>{summary?.[stat.key] ?? 0}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{stat.label}</p>
          </button>
        ))}
      </div>

      {activeStatKey && activeStat && (
        <ActivityList
          userId={userId}
          activityType={activeStat.activityType}
          period={period}
          color={activeStat.color}
          label={activeStat.label}
          onClose={() => setActiveStatKey(null)}
        />
      )}
    </div>
  );
}

// ── My Report Tab ─────────────────────────────────────────────────────────────
function MyReportTab({ period }: { period: ReportPeriod }) {
  const { data: summary, isLoading } = useMyReport(period);
  const { user } = useAuth();
  const [activeStatKey, setActiveStatKey] = useState<StatKey | null>(null);

  const handleStatClick = (key: StatKey) => {
    setActiveStatKey(prev => prev === key ? null : key);
  };

  const activeStat = STAT_DEFS.find(s => s.key === activeStatKey);

  return (
    <div className="space-y-5">
      <StatGrid
        summary={summary}
        isLoading={isLoading}
        onStatClick={handleStatClick}
        activeStatKey={activeStatKey}
      />
      {activeStatKey && activeStat && (
        <ActivityList
          userId={user?.id ?? null}
          activityType={activeStat.activityType}
          period={period}
          color={activeStat.color}
          label={activeStat.label}
          onClose={() => setActiveStatKey(null)}
        />
      )}
    </div>
  );
}

// ── Team Activity Tab ─────────────────────────────────────────────────────────
function UserReportTab({ period }: { period: ReportPeriod }) {
  const { data: myUsers, isLoading: usersLoading } = useMyUsers();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeStatKey, setActiveStatKey] = useState<StatKey | null>(null);
  const { data: summary, isLoading: reportLoading } = useUserReport(selectedUserId, period);

  const handleStatClick = (key: StatKey) => {
    setActiveStatKey(prev => prev === key ? null : key);
  };

  const activeStat = STAT_DEFS.find(s => s.key === activeStatKey);

  if (usersLoading) return <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;

  const teamUsers = myUsers?.filter((u: any) => u.role === 'user') ?? [];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Team Member</p>
        {teamUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No team members assigned to you yet. Ask admin to assign users to your account.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {teamUsers.map((u: any) => (
              <button
                key={u.id}
                onClick={() => {
                  setSelectedUserId(u.id === selectedUserId ? null : u.id);
                  setActiveStatKey(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all duration-200 ${
                  selectedUserId === u.id
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20'
                }`}
              >
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                  {u.username.substring(0, 1).toUpperCase()}
                </div>
                {u.username}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedUserId ? (
        <>
          <StatGrid
            summary={summary}
            isLoading={reportLoading}
            onStatClick={handleStatClick}
            activeStatKey={activeStatKey}
          />
          {activeStatKey && activeStat && (
            <ActivityList
              userId={selectedUserId}
              activityType={activeStat.activityType}
              period={period}
              color={activeStat.color}
              label={activeStat.label}
              onClose={() => setActiveStatKey(null)}
            />
          )}
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground text-sm rounded-2xl border border-white/8 bg-card">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
          Select a team member above to view their activity report
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Report() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<ReportPeriod>("today");
  const [activeTab, setActiveTab] = useState<'me' | 'team' | 'kpi'>('me');

  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Activity summary for <span className="text-foreground font-medium">{user?.username}</span>
          </p>
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                period === p.value
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      {isManagerOrAdmin && (
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('me')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'me'
                ? 'bg-card border border-white/10 text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            My Activity
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'team'
                ? 'bg-card border border-white/10 text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-4 w-4" /> Team Activity
          </button>
          <button
            onClick={() => setActiveTab('kpi')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'kpi'
                ? 'bg-card border border-white/10 text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="h-4 w-4" /> KPI Analytics
          </button>
        </div>
      )}

      {/* Content */}
      {activeTab === 'kpi' && isManagerOrAdmin ? (
        <KPITab period={period} />
      ) : activeTab === 'team' && isManagerOrAdmin ? (
        <UserReportTab period={period} />
      ) : (
        <MyReportTab period={period} />
      )}
    </div>
  );
}