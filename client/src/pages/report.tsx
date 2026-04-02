import { useState } from "react";
import { useMyReport, type ReportPeriod } from "@/hooks/use-reports";
import { useAuth } from "@/hooks/use-auth";
import {
  Phone, MessageCircle, MessageSquare, Plus, ArrowRightLeft,
  StickyNote, CalendarClock, Activity, Loader2, TrendingUp
} from "lucide-react";

type Period = { label: string; value: ReportPeriod };

const PERIODS: Period[] = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
];

export default function Report() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<ReportPeriod>("today");
  const { data: summary, isLoading } = useMyReport(period);

  const stats = [
    {
      label: "Calls Made",
      value: summary?.calls ?? 0,
      icon: Phone,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/20",
    },
    {
      label: "WhatsApp Sent",
      value: summary?.whatsapp ?? 0,
      icon: MessageCircle,
      color: "text-green-400",
      bg: "bg-green-400/10",
      border: "border-green-400/20",
    },
    {
      label: "SMS Sent",
      value: summary?.sms ?? 0,
      icon: MessageSquare,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      border: "border-blue-400/20",
    },
    {
      label: "Leads Created",
      value: summary?.leadsCreated ?? 0,
      icon: Plus,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
      border: "border-purple-400/20",
    },
    {
      label: "Status Changes",
      value: summary?.statusChanges ?? 0,
      icon: ArrowRightLeft,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      border: "border-amber-400/20",
    },
    {
      label: "Notes Added",
      value: summary?.notesAdded ?? 0,
      icon: StickyNote,
      color: "text-orange-400",
      bg: "bg-orange-400/10",
      border: "border-orange-400/20",
    },
    {
      label: "Follow-ups Set",
      value: summary?.followUpsSet ?? 0,
      icon: CalendarClock,
      color: "text-sky-400",
      bg: "bg-sky-400/10",
      border: "border-sky-400/20",
    },
    {
      label: "Total Activities",
      value: summary?.total ?? 0,
      icon: Activity,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">My Report</h1>
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

      {/* Total highlight */}
      {!isLoading && summary && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Activities — {PERIODS.find(p => p.value === period)?.label}</p>
            <p className="text-4xl font-display font-bold text-primary">{summary.total}</p>
          </div>
        </div>
      )}

      {/* Stats grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.slice(0, 7).map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl border ${stat.border} ${stat.bg} p-5 flex flex-col gap-3`}
            >
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
      )}

      {/* Activity breakdown bar */}
      {!isLoading && summary && summary.total > 0 && (
        <div className="rounded-2xl border border-white/8 bg-card p-6 space-y-4">
          <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">Activity Breakdown</h2>
          <div className="space-y-3">
            {stats.slice(0, 7).map((stat) => (
              <div key={stat.label} className="flex items-center gap-3">
                <div className="w-28 text-xs text-muted-foreground shrink-0">{stat.label}</div>
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