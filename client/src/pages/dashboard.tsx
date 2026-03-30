import { useLeads } from "@/hooks/use-leads";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, CheckCircle2, AlertCircle, Loader2, CalendarClock, CalendarCheck, CalendarX, TrendingUp, ChevronRight } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell } from "recharts";

function getToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function getTomorrow() {
  const d = getToday();
  d.setDate(d.getDate() + 1);
  return d;
}
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
    todayFollowup: leads?.filter(l => {
      if (!l.followUpDate) return false;
      return isSameDay(new Date(l.followUpDate), today);
    }).length || 0,
    tomorrowFollowup: leads?.filter(l => {
      if (!l.followUpDate) return false;
      return isSameDay(new Date(l.followUpDate), tomorrow);
    }).length || 0,
    overdue: leads?.filter(l => {
      if (!l.followUpDate) return false;
      const d = new Date(l.followUpDate);
      d.setHours(0, 0, 0, 0);
      return d < today;
    }).length || 0,
  };

  const leadSummaryCards = [
    {
      title: "Total Leads", value: stats.total, icon: Users,
      desc: "All recorded leads", color: "text-blue-600", bg: "bg-blue-50",
      link: "/leads"
    },
    {
      title: "Open Leads", value: stats.open, icon: AlertCircle,
      desc: "Requires attention", color: "text-orange-600", bg: "bg-orange-50",
      link: "/leads?status=Open"
    },
    {
      title: "Warm Leads", value: stats.warm, icon: Target,
      desc: "High intent prospects", color: "text-amber-600", bg: "bg-amber-50",
      link: "/leads?status=Warm"
    },
    {
      title: "Converted", value: stats.converted, icon: CheckCircle2,
      desc: "Successfully closed", color: "text-green-600", bg: "bg-green-50",
      link: "/leads?status=Converted"
    },
  ];

  const followupCards = [
    {
      title: "Will Register", value: stats.willRegister, icon: TrendingUp,
      desc: "Ready to convert", color: "text-purple-600", bg: "bg-purple-50",
      link: "/leads?status=Will+Convert"
    },
    {
      title: "Today Follow-up", value: stats.todayFollowup, icon: CalendarCheck,
      desc: "Follow up today", color: "text-sky-600", bg: "bg-sky-50",
      link: "/leads?followup=today"
    },
    {
      title: "Tomorrow Follow-up", value: stats.tomorrowFollowup, icon: CalendarClock,
      desc: "Follow up tomorrow", color: "text-indigo-600", bg: "bg-indigo-50",
      link: "/leads?followup=tomorrow"
    },
    {
      title: "Overdue", value: stats.overdue, icon: CalendarX,
      desc: "Missed follow-up", color: "text-red-600", bg: "bg-red-50",
      link: "/leads?followup=overdue"
    },
  ];

  const chartData = [
    { name: 'Open', value: stats.open, color: '#3b82f6', link: '/leads?status=Open' },
    { name: 'Warm', value: stats.warm, color: '#f59e0b', link: '/leads?status=Warm' },
    { name: 'Will Convert', value: stats.willRegister, color: '#8b5cf6', link: '/leads?status=Will+Convert' },
    { name: 'Converted', value: stats.converted, color: '#22c55e', link: '/leads?status=Converted' },
    { name: 'Not Interested', value: leads?.filter(l => l.status === 'Not Interested').length || 0, color: '#ef4444', link: '/leads?status=Not+Interested' },
    { name: 'Cold', value: leads?.filter(l => l.status === 'Cold').length || 0, color: '#64748b', link: '/leads?status=Cold' },
  ];

  const StatCard = ({ title, value, icon: Icon, desc, color, bg, link }: typeof leadSummaryCards[0]) => (
    <button
      onClick={() => navigate(link)}
      className="text-left w-full group"
      data-testid={`card-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <Card className="border-border/50 shadow-sm hover:shadow-md transition-all duration-200 group-hover:border-primary/20 group-hover:-translate-y-0.5">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
          <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          <div className="text-3xl font-display font-bold">{value}</div>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-xs text-muted-foreground">{desc}</p>
            <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </CardContent>
      </Card>
    </button>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-1">Click any card to view the filtered leads.</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Lead Summary</h2>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {leadSummaryCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Follow-up Summary</h2>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {followupCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border/40 bg-muted/20">
          <CardTitle className="text-lg">Lead Distribution</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                onClick={(data) => {
                  if (data?.activePayload?.[0]) {
                    const item = chartData.find(d => d.name === data.activePayload![0].payload.name);
                    if (item) navigate(item.link);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor' }} dx={-10} allowDecimals={false} />
                <RechartsTooltip
                  cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => [value, 'Leads']}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">Click a bar to filter leads by that status</p>
        </CardContent>
      </Card>
    </div>
  );
}
