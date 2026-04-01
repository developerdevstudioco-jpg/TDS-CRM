import { useLeads } from "@/hooks/use-leads";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, Target, CheckCircle2, AlertCircle, Loader2,
  CalendarClock, CalendarCheck, CalendarX, TrendingUp, ChevronRight, ArrowUpRight
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell } from "recharts";

function getToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function getTomorrow() { const d = getToday(); d.setDate(d.getDate() + 1); return d; }
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function Dashboard() {
  const { data: leads, isLoading } = useLeads();
  const [, setLocation] = useLocation();
  const navigate = (path: string) => setLocation(path);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  const today = getToday();
  const tomorrow = getTomorrow();

  const stats = {
    total: leads?.length || 0,
    open: leads?.filter(l => l.status === 'Open').length || 0,
    warm: leads?.filter(l => l.status === 'Warm').length || 0,
    converted: leads?.filter(l => l.status === 'Converted').length || 0,
    willRegister: leads?.filter(l => l.status === 'Will Convert').length || 0,
    todayFollowup: leads?.filter(l => l.followUpDate && isSameDay(new Date(l.followUpDate), today)).length || 0,
    tomorrowFollowup: leads?.filter(l => l.followUpDate && isSameDay(new Date(l.followUpDate), tomorrow)).length || 0,
    overdue: leads?.filter(l => {
      if (!l.followUpDate) return false;
      const d = new Date(l.followUpDate); d.setHours(0, 0, 0, 0);
      return d < today;
    }).length || 0,
  };

  const leadSummaryCards = [
    { title: "Total Leads", value: stats.total, icon: Users, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", link: "/leads" },
    { title: "Open Leads", value: stats.open, icon: AlertCircle, color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", link: "/leads?status=Open" },
    { title: "Warm Leads", value: stats.warm, icon: Target, color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20", link: "/leads?status=Warm" },
    { title: "Converted", value: stats.converted, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", link: "/leads?status=Converted" },
  ];

  const followupCards = [
    { title: "Will Register", value: stats.willRegister, icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20", link: "/leads?status=Will+Convert" },
    { title: "Today Follow-up", value: stats.todayFollowup, icon: CalendarCheck, color: "text-sky-400", bg: "bg-sky-400/10", border: "border-sky-400/20", link: "/leads?followup=today" },
    { title: "Tomorrow", value: stats.tomorrowFollowup, icon: CalendarClock, color: "text-indigo-400", bg: "bg-indigo-400/10", border: "border-indigo-400/20", link: "/leads?followup=tomorrow" },
    { title: "Overdue", value: stats.overdue, icon: CalendarX, color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20", link: "/leads?followup=overdue" },
  ];

  const chartData = [
    { name: 'Open', value: stats.open, color: '#60a5fa' },
    { name: 'Warm', value: stats.warm, color: '#fbbf24' },
    { name: 'Will Convert', value: stats.willRegister, color: '#a78bfa' },
    { name: 'Converted', value: stats.converted, color: '#34d399' },
    { name: 'Not Interested', value: leads?.filter(l => l.status === 'Not Interested').length || 0, color: '#f87171' },
    { name: 'Cold', value: leads?.filter(l => l.status === 'Cold').length || 0, color: '#94a3b8' },
  ];

  const StatCard = ({ title, value, icon: Icon, color, bg, border, link }: typeof leadSummaryCards[0]) => (
    <button onClick={() => navigate(link)} className="text-left w-full group">
      <div className={`relative rounded-2xl p-5 border ${border} ${bg} backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/30 overflow-hidden`}>
        {/* Subtle glow */}
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${bg} blur-xl`} />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className={`h-9 w-9 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <ArrowUpRight className={`h-4 w-4 ${color} opacity-0 group-hover:opacity-100 transition-opacity`} />
          </div>
          <div className={`text-3xl font-display font-bold ${color}`}>{value}</div>
          <p className="text-xs text-muted-foreground mt-1 font-medium">{title}</p>
        </div>
      </div>
    </button>
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-white/10 rounded-xl px-4 py-3 shadow-xl shadow-black/30">
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-lg font-bold text-foreground">{payload[0].value} <span className="text-xs font-normal text-muted-foreground">leads</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Click any card to view filtered leads.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-white/5 border border-white/10 rounded-xl px-4 py-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Lead Summary */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">Lead Summary</p>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {leadSummaryCards.map((card) => <StatCard key={card.title} {...card} />)}
        </div>
      </div>

      {/* Follow-up Summary */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">Follow-up Summary</p>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {followupCards.map((card) => <StatCard key={card.title} {...card} />)}
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-white/8 bg-card overflow-hidden">
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="font-display font-semibold text-foreground">Lead Distribution</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Click a bar to filter leads by status</p>
          </div>
          <div className="text-2xl font-display font-bold text-foreground">{stats.total}</div>
        </div>
        <div className="p-6">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={(data) => {
                  if (data?.activePayload?.[0]) {
                    const item = chartData.find(d => d.name === data.activePayload![0].payload.name);
                    if (item) navigate(`/leads?status=${encodeURIComponent(item.name)}`);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(215 14% 45%)' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(215 14% 45%)' }}
                  allowDecimals={false}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(220 12% 18% / 0.5)', radius: 6 }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={52}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}