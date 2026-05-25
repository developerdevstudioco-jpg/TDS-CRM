import { useState, useEffect } from "react";
import { useMyReport, useUserReport, useMyUsers, useActivityList, type ReportPeriod, type DateRange } from "@/hooks/use-reports";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Phone, MessageCircle, MessageSquare, Plus, ArrowRightLeft,
  StickyNote, CalendarClock, Loader2, TrendingUp, Users,
  ChevronDown, ChevronRight, X, BarChart3, AlertTriangle,
  CheckCircle2, UserCheck, Trophy, ArrowDown, Minus, Calendar
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend
} from "recharts";

// ── Period config ─────────────────────────────────────────────────────────────
type Period = { label: string; value: ReportPeriod };

const PERIODS: Period[] = [
  { label: "Today",      value: "today"  },
  { label: "This Week",  value: "week"   },
  { label: "This Month", value: "month"  },
  { label: "Custom",     value: "custom" },
];

type StatKey = 'calls' | 'whatsapp' | 'sms' | 'leadsCreated' | 'statusChanges' | 'notesAdded' | 'followUpsSet';

const STAT_DEFS: Array<{
  key: StatKey; label: string; icon: any;
  color: string; bg: string; border: string; activityType: string; hex: string;
}> = [
  { key: 'calls',         label: "Calls",          icon: Phone,          color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", activityType: 'call',          hex: '#34d399' },
  { key: 'whatsapp',      label: "WhatsApp",        icon: MessageCircle,  color: "text-green-400",   bg: "bg-green-400/10",   border: "border-green-400/20",   activityType: 'whatsapp',      hex: '#4ade80' },
  { key: 'sms',           label: "SMS",             icon: MessageSquare,  color: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/20",    activityType: 'sms',           hex: '#60a5fa' },
  { key: 'leadsCreated',  label: "Leads Created",   icon: Plus,           color: "text-purple-400",  bg: "bg-purple-400/10",  border: "border-purple-400/20",  activityType: 'created',       hex: '#a78bfa' },
  { key: 'statusChanges', label: "Status Changes",  icon: ArrowRightLeft, color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20",   activityType: 'status_change', hex: '#fbbf24' },
  { key: 'notesAdded',    label: "Notes",           icon: StickyNote,     color: "text-orange-400",  bg: "bg-orange-400/10",  border: "border-orange-400/20",  activityType: 'note',          hex: '#fb923c' },
  { key: 'followUpsSet',  label: "Follow-ups Set",  icon: CalendarClock,  color: "text-sky-400",     bg: "bg-sky-400/10",     border: "border-sky-400/20",     activityType: 'followup',      hex: '#38bdf8' },
];

// Colours for per-user pie slices
const USER_COLORS = ['#6366f1','#34d399','#f59e0b','#f43f5e','#38bdf8','#a78bfa','#fb923c','#4ade80','#e879f9','#94a3b8'];

// ── Custom pie tooltip ────────────────────────────────────────────────────────
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  return (
    <div className="bg-card border border-white/10 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-foreground">{name}</p>
      <p style={{ color: p.fill }}>{value} ({p.pct}%)</p>
    </div>
  );
}

// ── Custom legend ─────────────────────────────────────────────────────────────
function PieLegend({ data }: { data: { name: string; value: number; fill: string; pct: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-3">
      {data.filter(d => d.value > 0).map(d => (
        <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: d.fill }} />
          {d.name} <span className="font-semibold" style={{ color: d.fill }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Date range picker ─────────────────────────────────────────────────────────
function DateRangePicker({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  const today = new Date().toISOString().split("T")[0];
  const handleFrom = (from: string) => onChange({ from, to: range.to && from > range.to ? "" : range.to });
  const handleTo   = (to: string)   => onChange({ ...range, to });
  const setLast7   = () => onChange({ from: new Date(Date.now() - 6*86400000).toISOString().split("T")[0], to: today });
  const setLast30  = () => onChange({ from: new Date(Date.now() - 29*86400000).toISOString().split("T")[0], to: today });
  const setLastMonth = () => {
    const d = new Date();
    onChange({
      from: new Date(d.getFullYear(), d.getMonth()-1, 1).toISOString().split("T")[0],
      to:   new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split("T")[0],
    });
  };
  const dayCount = range.from && range.to
    ? Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / 86400000) + 1 : 0;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl border border-primary/20 bg-primary/5">
      <Calendar className="h-4 w-4 text-primary shrink-0" />
      <div className="flex items-center gap-1">
        {[{ label:"Last 7d",fn:setLast7 },{ label:"Last 30d",fn:setLast30 },{ label:"Last Month",fn:setLastMonth }].map(({label,fn})=>(
          <button key={label} onClick={fn} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors">{label}</button>
        ))}
      </div>
      <div className="h-4 w-px bg-white/10" />
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">From</span>
        <input type="date" max={range.to||today} value={range.from} onChange={e=>handleFrom(e.target.value)}
          className="text-xs bg-muted/30 border border-border/50 rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">To</span>
        <input type="date" min={range.from} max={today} value={range.to} onChange={e=>handleTo(e.target.value)}
          className="text-xs bg-muted/30 border border-border/50 rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50" />
      </div>
      {dayCount > 0 && (
        <span className="text-xs font-medium text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-lg">
          {dayCount} day{dayCount>1?"s":""}
        </span>
      )}
      {(range.from||range.to) && (
        <button onClick={()=>onChange({from:"",to:""})} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useUserSummary(userId: number | null, period: ReportPeriod, range?: DateRange) {
  return useQuery({
    queryKey: ["/api/reports/user", userId, period, range],
    enabled: userId !== null && (period !== 'custom' || (!!range?.from && !!range?.to)),
    queryFn: async () => {
      const params = period==='custom'&&range?.from&&range?.to ? `from=${range.from}&to=${range.to}` : `period=${period}`;
      const res = await fetch(`/api/reports/user/${userId}?${params}`, { credentials:"include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
}

function useUserLeadsKPI(userId: number | null, period: ReportPeriod, range?: DateRange) {
  return useQuery({
    queryKey: ["/api/reports/user", userId, period, range, "leads"],
    enabled: userId !== null && (period !== 'custom' || (!!range?.from && !!range?.to)),
    queryFn: async () => {
      const params = period==='custom'&&range?.from&&range?.to ? `from=${range.from}&to=${range.to}` : `period=${period}`;
      const res = await fetch(`/api/reports/user/${userId}/leads?${params}`, { credentials:"include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
}

function useMissedFollowupDays(userId: number | null) {
  return useQuery({
    queryKey: ["/api/missed-followup-days", userId],
    enabled: userId !== null,
    queryFn: async () => {
      const res = await fetch(`/api/missed-followup-days?userId=${userId}`, { credentials:"include" });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ missedDate: string }[]>;
    },
  });
}

function missedInPeriod(missedDays: { missedDate: string }[], period: ReportPeriod, range?: DateRange): number {
  const now = new Date();
  let from: Date;
  let to: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  if (period==='custom'&&range?.from&&range?.to) { from=new Date(range.from); to=new Date(range.to+"T23:59:59"); }
  else if (period==='today') { from=new Date(now); from.setHours(0,0,0,0); }
  else if (period==='week') { from=new Date(now); from.setDate(now.getDate()-now.getDay()); from.setHours(0,0,0,0); }
  else { from=new Date(now.getFullYear(),now.getMonth(),1); }
  return missedDays.filter(d=>{ const date=new Date(d.missedDate); return date>=from&&date<=to; }).length;
}

// ── Activity List ─────────────────────────────────────────────────────────────
function ActivityList({ userId, activityType, period, range, color, label, onClose }: {
  userId: number|null; activityType: string; period: ReportPeriod; range?: DateRange;
  color: string; label: string; onClose: ()=>void;
}) {
  const { data: activities, isLoading } = useActivityList(userId, activityType, period, range);
  const [expandedId, setExpandedId] = useState<number|null>(null);

  return (
    <div className="rounded-2xl border border-white/8 bg-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between">
        <span className={`text-sm font-medium ${color}`}>{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{isLoading?"...":`${activities?.length??0} records`}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !activities||activities.length===0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">No {label.toLowerCase()} in this period</div>
      ) : (
        <div className="divide-y divide-white/5">
          {activities.map((item: any) => (
            <div key={item.id}>
              <button onClick={()=>setExpandedId(expandedId===item.id?null:item.id)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.03] transition-colors">
                {expandedId===item.id ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate block">{item.leadName||"Unknown Lead"}</span>
                  {item.leadCompany&&<span className="text-xs text-muted-foreground">{item.leadCompany}</span>}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {new Date(item.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                </span>
              </button>
              {expandedId===item.id&&(
                <div className="px-5 pb-4 pt-2 bg-white/[0.02] border-t border-white/5">
                  {item.content&&<p className="text-sm text-muted-foreground">{item.content}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground/60">
                    {item.leadMobile&&<span>{item.leadMobile}</span>}
                    {item.leadStatus&&<span className="capitalize">Status: {item.leadStatus}</span>}
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
  summary: any; isLoading: boolean; onStatClick: (key: StatKey)=>void; activeStatKey: StatKey|null;
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
          const isActive = activeStatKey===stat.key;
          return (
            <button key={stat.key} onClick={()=>onStatClick(stat.key)}
              className={`rounded-2xl border ${stat.border} ${stat.bg} p-5 flex flex-col gap-3 text-left transition-all duration-200 ${
                isActive?'ring-2 ring-offset-2 ring-offset-background '+stat.border.replace('border-','ring-'):'hover:brightness-125'}`}>
              <div className={`h-9 w-9 rounded-xl ${stat.bg} border ${stat.border} flex items-center justify-center`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <p className={`text-3xl font-display font-bold ${stat.color}`}>{summary?.[stat.key]??0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </button>
          );
        })}
      </div>
      {summary&&summary.total>0&&(
        <div className="rounded-2xl border border-white/8 bg-card p-6 space-y-4">
          <h2 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">Activity Breakdown</h2>
          <div className="space-y-3">
            {STAT_DEFS.map((stat)=>(
              <div key={stat.key} className="flex items-center gap-3">
                <div className="w-32 text-xs text-muted-foreground shrink-0">{stat.label}</div>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${stat.bg.replace('/10','/60')}`}
                    style={{width:summary.total>0?`${((summary[stat.key]??0)/summary.total)*100}%`:'0%'}} />
                </div>
                <div className={`text-sm font-semibold ${stat.color} w-8 text-right`}>{summary?.[stat.key]??0}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── KPI Row ───────────────────────────────────────────────────────────────────
function KPIUserRowWithUpdate({ user, period, range, rank, maxCalls, maxConverted, onSelect, isSelected, onStatsLoaded }: {
  user: {id:number;username:string}; period:ReportPeriod; range?:DateRange;
  rank:number; maxCalls:number; maxConverted:number;
  onSelect:()=>void; isSelected:boolean;
  onStatsLoaded:(userId:number,calls:number,converted:number,total:number)=>void;
}) {
  const { data: summary } = useUserSummary(user.id, period, range);
  const { data: leads=[] } = useUserLeadsKPI(user.id, period, range);
  const { data: missedDays=[] } = useMissedFollowupDays(user.id);

  const calls         = summary?.calls??0;
  const converted     = (leads as any[]).filter((l:any)=>l.status==="Converted").length;
  const willRegister  = (leads as any[]).filter((l:any)=>l.status==="Will Register").length;
  const totalActivities = summary?.total??0;
  const missedFollowups = missedInPeriod(missedDays as any[], period, range);

  useEffect(()=>{ if(summary!==undefined) onStatsLoaded(user.id,calls,converted,totalActivities); },[calls,converted,totalActivities]);

  const rankEmoji = rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":null;
  const rankBg = rank===1?"bg-yellow-400/10 border-yellow-400/20 text-yellow-400"
    :rank===2?"bg-slate-300/10 border-slate-300/20 text-slate-300"
    :rank===3?"bg-amber-600/10 border-amber-600/20 text-amber-600":"";

  return (
    <tr onClick={onSelect} className={`border-b border-white/5 cursor-pointer transition-colors ${isSelected?"bg-primary/5":"hover:bg-white/[0.02]"}`}>
      <td className="px-4 py-3.5 w-12">
        {rankEmoji
          ? <div className={`h-7 w-7 rounded-lg border flex items-center justify-center text-xs font-bold ${rankBg}`}>{rankEmoji}</div>
          : <span className="text-sm text-muted-foreground/50 pl-1">{rank}</span>}
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {user.username.substring(0,2).toUpperCase()}
          </div>
          <span className="text-sm font-medium">{user.username}</span>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-emerald-400">{calls}</span>
          <div className="flex-1 max-w-[60px] h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400/50 rounded-full" style={{width:maxCalls>0?`${(calls/maxCalls)*100}%`:"0%"}} />
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
            <div className="h-full bg-purple-400/50 rounded-full" style={{width:maxConverted>0?`${(converted/maxConverted)*100}%`:"0%"}} />
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        {missedFollowups>0
          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400">
              <AlertTriangle className="h-3 w-3" />{missedFollowups} day{missedFollowups>1?"s":""}
            </span>
          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />Clean
            </span>}
      </td>
      <td className="px-4 py-3.5 text-right">
        <span className="text-sm font-bold text-foreground/80">{totalActivities}</span>
      </td>
    </tr>
  );
}

// ── User Detail KPI drill-down ────────────────────────────────────────────────
function UserDetailKPI({ userId, period, range }: { userId:number; period:ReportPeriod; range?:DateRange }) {
  const { data: summary, isLoading } = useUserSummary(userId, period, range);
  const { data: leads=[] } = useUserLeadsKPI(userId, period, range);
  const [activeStatKey, setActiveStatKey] = useState<StatKey|null>(null);
  const activeStat = STAT_DEFS.find(s=>s.key===activeStatKey);

  const willRegister = (leads as any[]).filter((l:any)=>l.status==="Will Register").length;
  const converted    = (leads as any[]).filter((l:any)=>l.status==="Converted").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:"Calls",          val:summary?.calls??0, color:"text-emerald-400",border:"border-emerald-400/20",bg:"bg-emerald-400/5"},
          {label:"Will Register",  val:willRegister,       color:"text-blue-400",   border:"border-blue-400/20",  bg:"bg-blue-400/5"  },
          {label:"Converted",      val:converted,          color:"text-purple-400", border:"border-purple-400/20",bg:"bg-purple-400/5"},
          {label:"Total Activities",val:summary?.total??0, color:"text-primary",    border:"border-primary/20",   bg:"bg-primary/5"  },
        ].map(({label,val,color,border,bg})=>(
          <div key={label} className={`rounded-xl border ${border} ${bg} p-4`}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-bold ${color} mt-1`}>{val}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        {STAT_DEFS.map((stat)=>(
          <button key={stat.key} onClick={()=>setActiveStatKey(prev=>prev===stat.key?null:stat.key)}
            className={`rounded-xl border ${stat.border} ${stat.bg} p-3 flex flex-col gap-1.5 text-left transition-all ${
              activeStatKey===stat.key?"ring-2 ring-offset-1 ring-offset-background "+stat.border.replace("border-","ring-"):"hover:brightness-125"}`}>
            <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
            <p className={`text-xl font-bold ${stat.color}`}>{summary?.[stat.key]??0}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{stat.label}</p>
          </button>
        ))}
      </div>
      {activeStatKey&&activeStat&&(
        <ActivityList userId={userId} activityType={activeStat.activityType}
          period={period} range={range} color={activeStat.color} label={activeStat.label}
          onClose={()=>setActiveStatKey(null)} />
      )}
    </div>
  );
}

// ── KPI Pie Charts ────────────────────────────────────────────────────────────
function KPIPieCharts({
  userStats,
  teamActivityTotals,
  teamUsers,
}: {
  userStats: Map<number, { calls: number; converted: number; total: number }>;
  teamActivityTotals: { key: StatKey; total: number }[];
  teamUsers: { id: number; username: string }[];
}) {
  const hasData = Array.from(userStats.values()).some(s => s.total > 0);
  if (!hasData) return null;

  // Pie 1: Activity type breakdown across the whole team
  const totalAllActivities = teamActivityTotals.reduce((s, a) => s + a.total, 0);
  const activityPieData = teamActivityTotals
    .filter(a => a.total > 0)
    .map(a => {
      const def = STAT_DEFS.find(d => d.key === a.key)!;
      return {
        name: def.label,
        value: a.total,
        fill: def.hex,
        pct: totalAllActivities > 0 ? ((a.total / totalAllActivities) * 100).toFixed(1) : "0",
      };
    });

  // Pie 2: Calls per user
  const totalCalls = Array.from(userStats.values()).reduce((s, v) => s + v.calls, 0);
  const callsPieData = teamUsers
    .map((u, idx) => ({
      name: u.username,
      value: userStats.get(u.id)?.calls ?? 0,
      fill: USER_COLORS[idx % USER_COLORS.length],
      pct: totalCalls > 0 ? (((userStats.get(u.id)?.calls ?? 0) / totalCalls) * 100).toFixed(1) : "0",
    }))
    .filter(d => d.value > 0);

  // Pie 3: Converted per user
  const totalConverted = Array.from(userStats.values()).reduce((s, v) => s + v.converted, 0);
  const convertedPieData = teamUsers
    .map((u, idx) => ({
      name: u.username,
      value: userStats.get(u.id)?.converted ?? 0,
      fill: USER_COLORS[idx % USER_COLORS.length],
      pct: totalConverted > 0 ? (((userStats.get(u.id)?.converted ?? 0) / totalConverted) * 100).toFixed(1) : "0",
    }))
    .filter(d => d.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Activity type breakdown */}
      <div className="rounded-2xl border border-white/8 bg-card p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Activity Mix</p>
        {activityPieData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={activityPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                  paddingAngle={2} dataKey="value">
                  {activityPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="transparent" />
                  ))}
                </Pie>
                <RechartsTooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <PieLegend data={activityPieData} />
          </>
        ) : (
          <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">No data</div>
        )}
      </div>

      {/* Calls per user */}
      <div className="rounded-2xl border border-white/8 bg-card p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Calls by Member
          <span className="ml-2 text-emerald-400 font-bold">{totalCalls}</span>
        </p>
        {callsPieData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={callsPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                  paddingAngle={2} dataKey="value">
                  {callsPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="transparent" />
                  ))}
                </Pie>
                <RechartsTooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <PieLegend data={callsPieData} />
          </>
        ) : (
          <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">No calls yet</div>
        )}
      </div>

      {/* Converted per user */}
      <div className="rounded-2xl border border-white/8 bg-card p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Conversions by Member
          <span className="ml-2 text-purple-400 font-bold">{totalConverted}</span>
        </p>
        {convertedPieData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={convertedPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                  paddingAngle={2} dataKey="value">
                  {convertedPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="transparent" />
                  ))}
                </Pie>
                <RechartsTooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <PieLegend data={convertedPieData} />
          </>
        ) : (
          <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">No conversions yet</div>
        )}
      </div>
    </div>
  );
}

// ── KPI Analytics Tab ─────────────────────────────────────────────────────────
function KPITab({ period, range }: { period: ReportPeriod; range?: DateRange }) {
  const { data: myUsers, isLoading } = useMyUsers();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<"calls" | "converted" | "total">("calls");
  const [userStats, setUserStats] = useState<Map<number, { calls: number; converted: number; total: number }>>(new Map());
  const [userActivityBreakdown, setUserActivityBreakdown] = useState<Map<number, Record<StatKey, number>>>(new Map());

  useEffect(() => { setSelectedUserId(null); }, [period, range]);

  const updateStat = (userId: number, calls: number, converted: number, total: number, breakdown: Record<StatKey, number>) => {
    setUserStats(prev => { const n = new Map(prev); n.set(userId, { calls, converted, total }); return n; });
    setUserActivityBreakdown(prev => { const n = new Map(prev); n.set(userId, breakdown); return n; });
  };

  const teamUsers = myUsers?.filter((u: any) => u.role === "user") ?? [];
  const sortedUsers = [...teamUsers].sort((a, b) => {
    const aS = userStats.get(a.id) ?? { calls:0, converted:0, total:0 };
    const bS = userStats.get(b.id) ?? { calls:0, converted:0, total:0 };
    return (bS[sortKey]??0) - (aS[sortKey]??0);
  });

  const maxCalls     = Math.max(...Array.from(userStats.values()).map(s=>s.calls), 1);
  const maxConverted = Math.max(...Array.from(userStats.values()).map(s=>s.converted), 1);

  // Team-wide activity totals for pie chart
  const teamActivityTotals = STAT_DEFS.map(def => ({
    key: def.key,
    total: Array.from(userActivityBreakdown.values()).reduce((s, b) => s + (b[def.key] ?? 0), 0),
  }));

  const SortBtn = ({ col, label }: { col: "calls"|"converted"|"total"; label: string }) => (
    <button onClick={()=>setSortKey(col)}
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors ${sortKey===col?"text-primary":"text-muted-foreground hover:text-foreground"}`}>
      {label}
      {sortKey===col ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3 opacity-30" />}
    </button>
  );

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  if (teamUsers.length===0) return (
    <div className="text-center py-12 text-muted-foreground text-sm rounded-2xl border border-white/8 bg-card">
      <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />No team members assigned yet.
    </div>
  );

  const totalCalls      = Array.from(userStats.values()).reduce((s,v)=>s+v.calls,0);
  const totalConverted  = Array.from(userStats.values()).reduce((s,v)=>s+v.converted,0);
  const totalActivities = Array.from(userStats.values()).reduce((s,v)=>s+v.total,0);

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
          <p className="text-xs text-muted-foreground">Total Calls</p>
          <p className="text-3xl font-display font-bold text-emerald-400 mt-1">{totalCalls}</p>
        </div>
        <div className="rounded-2xl border border-blue-400/20 bg-blue-400/5 p-5">
          <p className="text-xs text-muted-foreground">Team Members</p>
          <p className="text-3xl font-display font-bold text-blue-400 mt-1">{teamUsers.length}</p>
        </div>
        <div className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-5">
          <p className="text-xs text-muted-foreground">Total Converted</p>
          <p className="text-3xl font-display font-bold text-purple-400 mt-1">{totalConverted}</p>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <p className="text-xs text-muted-foreground">Total Activities</p>
          <p className="text-3xl font-display font-bold text-primary mt-1">{totalActivities}</p>
        </div>
      </div>

      {/* ── Pie Charts ── */}
      <KPIPieCharts
        userStats={userStats}
        teamActivityTotals={teamActivityTotals}
        teamUsers={teamUsers}
      />

      {/* Leaderboard table */}
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
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-emerald-400" />Calls</span>
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1"><UserCheck className="h-3 w-3 text-blue-400" />Will Register</span>
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-purple-400" />Converted</span>
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-400" />Missed FU</span>
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user,idx)=>(
                <KPIUserRowWithUpdateFull
                  key={user.id}
                  user={user} period={period} range={range}
                  rank={idx+1} maxCalls={maxCalls} maxConverted={maxConverted}
                  onSelect={()=>setSelectedUserId(selectedUserId===user.id?null:user.id)}
                  isSelected={selectedUserId===user.id}
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
      {selectedUserId&&(()=>{
        const u = teamUsers.find((u:any)=>u.id===selectedUserId);
        return u?(
          <div className="rounded-2xl border border-white/8 bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {u.username.substring(0,2).toUpperCase()}
                </div>
                <span className="font-semibold text-sm">{u.username} — Detail</span>
              </div>
              <button onClick={()=>setSelectedUserId(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <UserDetailKPI userId={selectedUserId} period={period} range={range} />
            </div>
          </div>
        ):null;
      })()}
    </div>
  );
}

// Full row that also reports activity breakdown for pie charts
function KPIUserRowWithUpdateFull({ user, period, range, rank, maxCalls, maxConverted, onSelect, isSelected, onStatsLoaded }: {
  user:{id:number;username:string}; period:ReportPeriod; range?:DateRange;
  rank:number; maxCalls:number; maxConverted:number;
  onSelect:()=>void; isSelected:boolean;
  onStatsLoaded:(userId:number,calls:number,converted:number,total:number,breakdown:Record<StatKey,number>)=>void;
}) {
  const { data: summary } = useUserSummary(user.id, period, range);
  const { data: leads=[] } = useUserLeadsKPI(user.id, period, range);
  const { data: missedDays=[] } = useMissedFollowupDays(user.id);

  const calls          = summary?.calls??0;
  const converted      = (leads as any[]).filter((l:any)=>l.status==="Converted").length;
  const willRegister   = (leads as any[]).filter((l:any)=>l.status==="Will Register").length;
  const totalActivities = summary?.total??0;
  const missedFollowups = missedInPeriod(missedDays as any[], period, range);

  useEffect(()=>{
    if (summary!==undefined) {
      const breakdown = {
        calls: summary.calls??0, whatsapp: summary.whatsapp??0, sms: summary.sms??0,
        leadsCreated: summary.leadsCreated??0, statusChanges: summary.statusChanges??0,
        notesAdded: summary.notesAdded??0, followUpsSet: summary.followUpsSet??0,
      } as Record<StatKey,number>;
      onStatsLoaded(user.id, calls, converted, totalActivities, breakdown);
    }
  }, [calls, converted, totalActivities, summary]);

  const rankEmoji = rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":null;
  const rankBg = rank===1?"bg-yellow-400/10 border-yellow-400/20 text-yellow-400"
    :rank===2?"bg-slate-300/10 border-slate-300/20 text-slate-300"
    :rank===3?"bg-amber-600/10 border-amber-600/20 text-amber-600":"";

  return (
    <tr onClick={onSelect} className={`border-b border-white/5 cursor-pointer transition-colors ${isSelected?"bg-primary/5":"hover:bg-white/[0.02]"}`}>
      <td className="px-4 py-3.5 w-12">
        {rankEmoji
          ? <div className={`h-7 w-7 rounded-lg border flex items-center justify-center text-xs font-bold ${rankBg}`}>{rankEmoji}</div>
          : <span className="text-sm text-muted-foreground/50 pl-1">{rank}</span>}
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {user.username.substring(0,2).toUpperCase()}
          </div>
          <span className="text-sm font-medium">{user.username}</span>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-emerald-400">{calls}</span>
          <div className="flex-1 max-w-[60px] h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400/50 rounded-full" style={{width:maxCalls>0?`${(calls/maxCalls)*100}%`:"0%"}} />
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
            <div className="h-full bg-purple-400/50 rounded-full" style={{width:maxConverted>0?`${(converted/maxConverted)*100}%`:"0%"}} />
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        {missedFollowups>0
          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400">
              <AlertTriangle className="h-3 w-3" />{missedFollowups} day{missedFollowups>1?"s":""}
            </span>
          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />Clean
            </span>}
      </td>
      <td className="px-4 py-3.5 text-right">
        <span className="text-sm font-bold text-foreground/80">{totalActivities}</span>
      </td>
    </tr>
  );
}

// ── My Report Tab ─────────────────────────────────────────────────────────────
function MyReportTab({ period, range }: { period: ReportPeriod; range?: DateRange }) {
  const { data: summary, isLoading } = useMyReport(period, range);
  const { user } = useAuth();
  const [activeStatKey, setActiveStatKey] = useState<StatKey|null>(null);
  const activeStat = STAT_DEFS.find(s=>s.key===activeStatKey);

  return (
    <div className="space-y-5">
      <StatGrid summary={summary} isLoading={isLoading}
        onStatClick={key=>setActiveStatKey(prev=>prev===key?null:key)}
        activeStatKey={activeStatKey} />
      {activeStatKey&&activeStat&&(
        <ActivityList userId={user?.id??null} activityType={activeStat.activityType}
          period={period} range={range} color={activeStat.color} label={activeStat.label}
          onClose={()=>setActiveStatKey(null)} />
      )}
    </div>
  );
}

// ── Team Activity Tab ─────────────────────────────────────────────────────────
function UserReportTab({ period, range }: { period: ReportPeriod; range?: DateRange }) {
  const { data: myUsers, isLoading: usersLoading } = useMyUsers();
  const [selectedUserId, setSelectedUserId] = useState<number|null>(null);
  const [activeStatKey, setActiveStatKey] = useState<StatKey|null>(null);
  const { data: summary, isLoading: reportLoading } = useUserReport(selectedUserId, period, range);
  const activeStat = STAT_DEFS.find(s=>s.key===activeStatKey);

  if (usersLoading) return <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;

  const teamUsers = myUsers?.filter((u:any)=>u.role==='user')??[];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Team Member</p>
        {teamUsers.length===0?(
          <p className="text-sm text-muted-foreground py-4">No team members assigned to you yet. Ask admin to assign users to your account.</p>
        ):(
          <div className="flex flex-wrap gap-2">
            {teamUsers.map((u:any)=>(
              <button key={u.id} onClick={()=>{ setSelectedUserId(u.id===selectedUserId?null:u.id); setActiveStatKey(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all duration-200 ${
                  selectedUserId===u.id?'bg-primary/10 border-primary/30 text-primary':'bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20'}`}>
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                  {u.username.substring(0,1).toUpperCase()}
                </div>
                {u.username}
              </button>
            ))}
          </div>
        )}
      </div>
      {selectedUserId?(
        <>
          <StatGrid summary={summary} isLoading={reportLoading}
            onStatClick={key=>setActiveStatKey(prev=>prev===key?null:key)}
            activeStatKey={activeStatKey} />
          {activeStatKey&&activeStat&&(
            <ActivityList userId={selectedUserId} activityType={activeStat.activityType}
              period={period} range={range} color={activeStat.color} label={activeStat.label}
              onClose={()=>setActiveStatKey(null)} />
          )}
        </>
      ):(
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
  const [customRange, setCustomRange] = useState<DateRange>({ from:"", to:"" });
  const [activeTab, setActiveTab] = useState<'me'|'team'|'kpi'>('me');

  const isManagerOrAdmin = user?.role==='manager'||user?.role==='admin';
  const effectiveRange = period==='custom'&&customRange.from&&customRange.to ? customRange : undefined;
  const customReady = period!=='custom'||(!!customRange.from&&!!customRange.to);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Activity summary for <span className="text-foreground font-medium">{user?.username}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {PERIODS.map((p)=>(
            <button key={p.value} onClick={()=>setPeriod(p.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                period===p.value?'bg-primary text-primary-foreground shadow-lg shadow-primary/20':'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}>
              {p.value==='custom'&&<Calendar className="h-3.5 w-3.5" />}
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {period==='custom'&&<DateRangePicker range={customRange} onChange={setCustomRange} />}
      {period==='custom'&&(!customRange.from||!customRange.to)&&(
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
          <Calendar className="h-4 w-4" />Select both a start and end date to load the report.
        </div>
      )}

      {isManagerOrAdmin&&(
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
          {[
            {key:'me',   label:"My Activity",   icon:null     },
            {key:'team', label:"Team Activity",  icon:Users    },
            {key:'kpi',  label:"KPI Analytics",  icon:BarChart3},
          ].map(({key,label,icon:Icon})=>(
            <button key={key} onClick={()=>setActiveTab(key as any)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab===key?'bg-card border border-white/10 text-foreground shadow-sm':'text-muted-foreground hover:text-foreground'}`}>
              {Icon&&<Icon className="h-4 w-4" />}
              {label}
            </button>
          ))}
        </div>
      )}

      {customReady&&(
        activeTab==='kpi'&&isManagerOrAdmin ? <KPITab period={period} range={effectiveRange} />
        : activeTab==='team'&&isManagerOrAdmin ? <UserReportTab period={period} range={effectiveRange} />
        : <MyReportTab period={period} range={effectiveRange} />
      )}
    </div>
  );
}