import { useState } from "react";
import { useMyReport, useUserReport, useMyUsers, useActivityList, type ReportPeriod } from "@/hooks/use-reports";
import { useAuth } from "@/hooks/use-auth";
import {
  Phone, MessageCircle, MessageSquare, Plus, ArrowRightLeft,
  StickyNote, CalendarClock, Activity, Loader2, TrendingUp, Users,
  ChevronDown, ChevronRight, X
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

function StatGrid({ summary, isLoading, onStatClick, activeStatKey }: {
  summary: any;
  isLoading: boolean;
  onStatClick: (key: StatKey) => void;
  activeStatKey: StatKey | null;
}) {
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

      {/* Clickable stats grid */}
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

      {/* Breakdown bar */}
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