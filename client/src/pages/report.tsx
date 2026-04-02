import { useState } from "react";
import { useMyReport, useUserReport, useMyUsers, type ReportPeriod } from "@/hooks/use-reports";
import { useAuth } from "@/hooks/use-auth";
import {
  Phone, MessageCircle, MessageSquare, Plus, ArrowRightLeft,
  StickyNote, CalendarClock, Activity, Loader2, TrendingUp, Users
} from "lucide-react";

type Period = { label: string; value: ReportPeriod };

const PERIODS: Period[] = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
];

function StatGrid({ summary, isLoading }: { summary: any; isLoading: boolean }) {
  const stats = [
    { label: "Calls Made", value: summary?.calls ?? 0, icon: Phone, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
    { label: "WhatsApp Sent", value: summary?.whatsapp ?? 0, icon: MessageCircle, color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/20" },
    { label: "SMS Sent", value: summary?.sms ?? 0, icon: MessageSquare, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
    { label: "Leads Created", value: summary?.leadsCreated ?? 0, icon: Plus, color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20" },
    { label: "Status Changes", value: summary?.statusChanges ?? 0, icon: ArrowRightLeft, color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
    { label: "Notes Added", value: summary?.notesAdded ?? 0, icon: StickyNote, color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" },
    { label: "Follow-ups Set", value: summary?.followUpsSet ?? 0, icon: CalendarClock, color: "text-sky-400", bg: "bg-sky-400/10", border: "border-sky-400/20" },
  ];

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Total highlight */}
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

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-2xl border ${stat.border} ${stat.bg} p-5 flex flex-col gap-3`}>
            <div className={`h-9 w-9 rounded-xl ${stat.bg} border ${stat.border} flex items-center justify-center`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div>
              <p className={`text-3xl font-display font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Breakdown bar */}
      {summary && summary.total > 0 && (
        <div className="rounded-2xl border border-white/8 bg-card p-6 space-y-4">
          <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">Activity Breakdown</h2>
          <div className="space-y-3">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-3">
                <div className="w-32 text-xs text-muted-foreground shrink-0">{stat.label}</div>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${stat.bg.replace('/10', '/60')}`}
                    style={{ width: summary.total > 0 ? `${(stat.value / summary.total) * 100}%` : '0%' }}
                  />
                </div>
                <div className={`text-sm font-semibold ${stat.color} w-8 text-right`}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MyReportTab({ period }: { period: ReportPeriod }) {
  const { data: summary, isLoading } = useMyReport(period);
  return <StatGrid summary={summary} isLoading={isLoading} />;
}

function UserReportTab({ period }: { period: ReportPeriod }) {
  const { data: myUsers, isLoading: usersLoading } = useMyUsers();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const { data: summary, isLoading: reportLoading } = useUserReport(selectedUserId, period);

  if (usersLoading) return <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;

  const teamUsers = myUsers?.filter(u => u.role === 'user') ?? [];

  return (
    <div className="space-y-5">
      {/* User selector */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Team Member</p>
        {teamUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No team members assigned to you yet. Ask admin to assign users to your account.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {teamUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUserId(u.id === selectedUserId ? null : u.id)}
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

      {/* Selected user report */}
      {selectedUserId ? (
        <StatGrid summary={summary} isLoading={reportLoading} />
      ) : (
        <div className="text-center py-12 text-muted-foreground text-sm rounded-2xl border border-white/8 bg-card">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
          Select a team member above to view their activity report
        </div>
      )}
    </div>
  );
}

export default function Report() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<ReportPeriod>("today");
  const [activeTab, setActiveTab] = useState<'me' | 'team'>('me');

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

      {/* Tab switcher for manager/admin */}
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
        </div>
      )}

      {/* Content */}
      {activeTab === 'me' || !isManagerOrAdmin ? (
        <MyReportTab period={period} />
      ) : (
        <UserReportTab period={period} />
      )}
    </div>
  );
}