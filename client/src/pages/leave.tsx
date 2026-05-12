import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CalendarDays, Plus, Loader2, CheckCircle2, XCircle, Clock,
  AlertTriangle, Info, Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface LeaveRequest {
  id: number;
  userId: number;
  managerId: number | null;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  isLop: boolean;
  managerNote: string | null;
  createdAt: string;
  username?: string;
  managerName?: string;
}

interface Lead {
  id: number;
  followUpDate: string | null;
  status: string;
  assignedTo: number | null;
}

// ── Hooks ────────────────────────────────────────────────────────────────────
function useLeaves() {
  return useQuery<LeaveRequest[]>({
    queryKey: ["/api/leaves"],
    queryFn: async () => {
      const res = await fetch("/api/leaves", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leaves");
      return res.json();
    },
  });
}

function useMyLeads() {
  return useQuery<Lead[]>({
    queryKey: ["/api/leads/my"],
    queryFn: async () => {
      const res = await fetch("/api/leads", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });
}

function useApplyLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { startDate: string; endDate: string; reason?: string }) => {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to apply leave");
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/leaves"] }),
  });
}

function useUpdateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, managerNote }: { id: number; status: string; managerNote?: string }) => {
      const res = await fetch(`/api/leaves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, managerNote }),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update leave");
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/leaves"] }),
  });
}

function useCancelLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/leaves/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Failed to cancel leave");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/leaves"] }),
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function getWorkingDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) return 0;
  let days = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getDay() !== 0) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function StatusBadge({ status, isLop }: { status: string; isLop: boolean }) {
  if (status === "approved")
    return (
      <div className="flex items-center gap-1.5">
        <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/20 hover:bg-emerald-400/10">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
        </Badge>
        {isLop && <Badge variant="outline" className="text-orange-400 border-orange-400/30 text-[10px]">LOP</Badge>}
      </div>
    );
  if (status === "rejected")
    return <Badge className="bg-red-400/10 text-red-400 border-red-400/20 hover:bg-red-400/10"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
  return (
    <div className="flex items-center gap-1.5">
      <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/20 hover:bg-amber-400/10">
        <Clock className="h-3 w-3 mr-1" /> Pending
      </Badge>
      {isLop && <Badge variant="outline" className="text-orange-400 border-orange-400/30 text-[10px]">LOP</Badge>}
    </div>
  );
}

// ── Mini Calendar ─────────────────────────────────────────────────────────────
function LeaveCalendar({
  leaves,
  leads,
  userId,
}: {
  leaves: LeaveRequest[];
  leads: Lead[];
  userId: number;
}) {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-indexed

  const monthName = new Date(calYear, calMonth, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

  // Build set of leave days (approved or pending) for current user
  const leaveDays = useMemo(() => {
    const set = new Set<string>();
    for (const l of leaves) {
      if (l.userId !== userId) continue;
      if (l.status === "rejected") continue;
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      const cur = new Date(start);
      while (cur <= end) {
        set.add(toDateKey(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }
    return set;
  }, [leaves, userId]);

  // Build set of red days: overdue follow-ups (past) + today's uncleared follow-ups
  const redDays = useMemo(() => {
    const set = new Set<string>();
    const todayKey = toDateKey(today);
    for (const lead of leads) {
      if (!lead.followUpDate) continue;
      const fDate = new Date(lead.followUpDate);
      const fKey = toDateKey(fDate);
      // Overdue = follow-up date is before today
      // Today's uncleared = follow-up date is today
      // Both should show red (they should be 0 at end of day)
      if (fKey <= todayKey) {
        set.add(fKey);
      }
    }
    return set;
  }, [leads]);

  // Build calendar grid
  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const todayKey = toDateKey(today);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="p-4 border-b border-border/40 bg-muted/10">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{monthName}</p>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const key = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isLeave = leaveDays.has(key);
            const isRed = redDays.has(key);
            const isToday = key === todayKey;
            const isSunday = new Date(calYear, calMonth, day).getDay() === 0;

            let cellClass = "relative flex items-center justify-center h-8 w-full rounded-lg text-xs font-medium transition-colors ";

            if (isLeave) {
              cellClass += "bg-pink-500/20 text-pink-400 border border-pink-500/30";
            } else if (isRed) {
              cellClass += "bg-red-500/20 text-red-400 border border-red-500/30";
            } else if (isToday) {
              cellClass += "bg-primary/20 text-primary border border-primary/30 font-bold";
            } else if (isSunday) {
              cellClass += "text-muted-foreground/40";
            } else {
              cellClass += "text-foreground/70 hover:bg-muted/20";
            }

            return (
              <div key={key} className={cellClass}>
                {day}
                {isToday && !isLeave && !isRed && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-pink-500/30 border border-pink-500/40" />
            <span className="text-[10px] text-muted-foreground">Leave</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-red-500/30 border border-red-500/40" />
            <span className="text-[10px] text-muted-foreground">Overdue / Today follow-up</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-primary/20 border border-primary/30" />
            <span className="text-[10px] text-muted-foreground">Today</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function Leave() {
  const { user: currentUser } = useAuth();
  const { data: leaves, isLoading } = useLeaves();
  const { data: leads = [] } = useMyLeads();
  const applyLeave = useApplyLeave();
  const updateLeave = useUpdateLeave();
  const cancelLeave = useCancelLeave();
  const { toast } = useToast();

  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({ startDate: "", endDate: "", reason: "" });

  const [reviewLeave, setReviewLeave] = useState<LeaveRequest | null>(null);
  const [managerNote, setManagerNote] = useState("");

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const isAdminOrManager = currentUser?.role === "admin" || currentUser?.role === "manager";

  // Monthly summary for current user (user role)
  const monthlyStats = useMemo(() => {
    if (!leaves || isAdminOrManager) return null;
    const now = new Date();
    const thisMonth = leaves.filter((l) => {
      const d = new Date(l.startDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        && l.status !== "rejected";
    });
    const used = thisMonth.reduce((s, l) => s + l.days, 0);
    const lopDays = Math.max(0, used - 2);
    return { used, remaining: Math.max(0, 2 - used), lop: lopDays };
  }, [leaves, isAdminOrManager]);

  // Preview days & LOP when applying
  const previewDays = getWorkingDays(applyForm.startDate, applyForm.endDate);
  const previewLop = monthlyStats ? Math.max(0, previewDays - monthlyStats.remaining) : 0;

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewDays === 0) {
      toast({ title: "Invalid dates", description: "No working days in selected range.", variant: "destructive" });
      return;
    }
    // Enforce max 2 leaves per month
    if (monthlyStats && monthlyStats.used >= 2) {
      toast({
        title: "Monthly limit reached",
        description: "You have already used 2 leaves this month. Additional days will be Loss of Pay.",
      });
    }
    try {
      const result = await applyLeave.mutateAsync(applyForm);
      toast({
        title: "Leave applied successfully",
        description: result.isLop
          ? `${result.lopDays} day(s) will be Loss of Pay`
          : "Within your monthly quota",
      });
      setIsApplyOpen(false);
      setApplyForm({ startDate: "", endDate: "", reason: "" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReview = async (status: "approved" | "rejected") => {
    if (!reviewLeave) return;
    try {
      await updateLeave.mutateAsync({ id: reviewLeave.id, status, managerNote });
      toast({ title: `Leave ${status}` });
      setReviewLeave(null);
      setManagerNote("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Cancel this leave request?")) return;
    try {
      await cancelLeave.mutateAsync(id);
      toast({ title: "Leave cancelled" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const today = new Date().toISOString().split("T")[0];

  // Overdue & today follow-up count (for warning banner)
  const pendingFollowUps = useMemo(() => {
    const todayKey = today;
    return leads.filter(l => {
      if (!l.followUpDate) return false;
      const fKey = toDateKey(new Date(l.followUpDate));
      return fKey <= todayKey;
    }).length;
  }, [leads, today]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Leave Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isAdminOrManager ? "Review and manage your team's leave requests." : "Apply and track your leave requests."}
          </p>
        </div>
        {!isAdminOrManager && (
          <Button className="hover-elevate" onClick={() => setIsApplyOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Apply Leave
          </Button>
        )}
      </div>

      {/* Overdue follow-up warning banner */}
      {!isAdminOrManager && pendingFollowUps > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <span className="text-red-400 font-medium">
            {pendingFollowUps} follow-up{pendingFollowUps > 1 ? "s" : ""} overdue or due today
          </span>
          <span className="text-muted-foreground">— clear them so your calendar shows clean days.</span>
        </div>
      )}

      {/* Monthly quota cards — user role only */}
      {!isAdminOrManager && monthlyStats && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Used This Month</p>
                <p className="text-2xl font-bold">{monthlyStats.used}<span className="text-sm font-normal text-muted-foreground">/2</span></p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="text-2xl font-bold text-emerald-400">{monthlyStats.remaining}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-400/10 border border-orange-400/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Loss of Pay Days</p>
                <p className="text-2xl font-bold text-orange-400">{monthlyStats.lop}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Calendar + Table layout */}
      <div className={!isAdminOrManager ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : ""}>
        {/* Calendar — user only */}
        {!isAdminOrManager && leaves && currentUser && (
          <div className="lg:col-span-1">
            <LeaveCalendar
              leaves={leaves}
              leads={leads}
              userId={currentUser.id}
            />
          </div>
        )}

        {/* Leave Table */}
        <div className={!isAdminOrManager ? "lg:col-span-2" : ""}>
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="p-4 border-b border-border/40 bg-muted/10">
              <p className="text-sm font-semibold">
                {isAdminOrManager ? "Team Leave Requests" : "My Leave History"}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !leaves?.length ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <CalendarDays className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="font-medium">No leave requests yet</p>
                  {!isAdminOrManager && <p className="text-sm text-muted-foreground mt-1">Click "Apply Leave" to submit a request.</p>}
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/5">
                    <TableRow>
                      {isAdminOrManager && <TableHead className="font-semibold">Employee</TableHead>}
                      <TableHead className="font-semibold">Dates</TableHead>
                      <TableHead className="font-semibold">Days</TableHead>
                      <TableHead className="font-semibold">Reason</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Applied On</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaves.map((leave) => (
                      <>
                        <TableRow key={leave.id} className="cursor-pointer hover:bg-muted/5"
                          onClick={() => setExpandedId(expandedId === leave.id ? null : leave.id)}>
                          {isAdminOrManager && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold uppercase">
                                  {leave.username?.substring(0, 2)}
                                </div>
                                <span className="font-medium text-sm">{leave.username}</span>
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="text-sm">
                            <div>{formatDate(leave.startDate)}</div>
                            {leave.startDate !== leave.endDate && (
                              <div className="text-muted-foreground text-xs">to {formatDate(leave.endDate)}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">{leave.days}</span>
                            <span className="text-muted-foreground text-xs ml-1">day{leave.days > 1 ? "s" : ""}</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                            {leave.reason || "—"}
                          </TableCell>
                          <TableCell><StatusBadge status={leave.status} isLop={leave.isLop} /></TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {leave.createdAt ? formatDate(leave.createdAt) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isAdminOrManager && leave.status === "pending" && (
                                <Button size="sm" variant="ghost" className="text-emerald-400 hover:text-emerald-400 hover:bg-emerald-400/10"
                                  onClick={(e) => { e.stopPropagation(); setReviewLeave(leave); setManagerNote(""); }}>
                                  Review
                                </Button>
                              )}
                              {!isAdminOrManager && leave.status === "pending" && (
                                <Button size="sm" variant="ghost"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => { e.stopPropagation(); handleCancel(leave.id); }}
                                  disabled={cancelLeave.isPending}>
                                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Cancel
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="text-muted-foreground px-2"
                                onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === leave.id ? null : leave.id); }}>
                                {expandedId === leave.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedId === leave.id && (
                          <TableRow key={`${leave.id}-detail`} className="bg-muted/5">
                            <TableCell colSpan={isAdminOrManager ? 7 : 6} className="py-3 px-6">
                              <div className="flex flex-wrap gap-6 text-sm">
                                {leave.reason && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">Reason</p>
                                    <p>{leave.reason}</p>
                                  </div>
                                )}
                                {leave.isLop && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">Leave Type</p>
                                    <p className="text-orange-400 font-medium">Includes Loss of Pay days</p>
                                  </div>
                                )}
                                {leave.managerNote && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">Manager Note</p>
                                    <p>{leave.managerNote}</p>
                                  </div>
                                )}
                                {isAdminOrManager && leave.managerName && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">Reviewed By</p>
                                    <p>{leave.managerName}</p>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Apply Leave Dialog */}
      <Dialog open={isApplyOpen} onOpenChange={(o) => { setIsApplyOpen(o); if (!o) setApplyForm({ startDate: "", endDate: "", reason: "" }); }}>
        <DialogContent>
          <form onSubmit={handleApply}>
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Quota info */}
              {monthlyStats && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-400/5 border border-blue-400/20 text-sm">
                  <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-blue-400">This month: </span>
                    <span className="text-muted-foreground">
                      {monthlyStats.used} used · {monthlyStats.remaining} remaining · Max 2/month (Mon–Sat)
                    </span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input id="start-date" type="date" min={today} required
                    value={applyForm.startDate}
                    onChange={e => setApplyForm({ ...applyForm, startDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input id="end-date" type="date" min={applyForm.startDate || today} required
                    value={applyForm.endDate}
                    onChange={e => setApplyForm({ ...applyForm, endDate: e.target.value })} />
                </div>
              </div>
              {/* Live preview */}
              {previewDays > 0 && (
                <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm border ${previewLop > 0 ? "bg-orange-400/5 border-orange-400/20" : "bg-emerald-400/5 border-emerald-400/20"}`}>
                  {previewLop > 0
                    ? <AlertTriangle className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
                    : <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />}
                  <div>
                    <span className="font-medium">{previewDays} working day{previewDays > 1 ? "s" : ""}</span>
                    {previewLop > 0
                      ? <span className="text-orange-400 ml-1">· {previewLop} day{previewLop > 1 ? "s" : ""} will be LOP</span>
                      : <span className="text-emerald-400 ml-1">· Within your quota</span>}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea id="reason" placeholder="e.g. Personal work, medical..."
                  className="resize-none min-h-[80px]"
                  value={applyForm.reason}
                  onChange={e => setApplyForm({ ...applyForm, reason: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setIsApplyOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={applyLeave.isPending || previewDays === 0}>
                {applyLeave.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review Leave Dialog — manager/admin */}
      <Dialog open={!!reviewLeave} onOpenChange={(o) => { if (!o) { setReviewLeave(null); setManagerNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Leave Request</DialogTitle>
          </DialogHeader>
          {reviewLeave && (
            <div className="py-2 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Employee</p>
                  <p className="font-medium">{reviewLeave.username}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-medium">{reviewLeave.days} day{reviewLeave.days > 1 ? "s" : ""}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">From</p>
                  <p className="font-medium">{formatDate(reviewLeave.startDate)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">To</p>
                  <p className="font-medium">{formatDate(reviewLeave.endDate)}</p>
                </div>
              </div>
              {reviewLeave.reason && (
                <div className="text-sm space-y-1">
                  <p className="text-xs text-muted-foreground">Reason</p>
                  <p className="bg-muted/20 rounded-lg px-3 py-2">{reviewLeave.reason}</p>
                </div>
              )}
              {reviewLeave.isLop && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-400/5 border border-orange-400/20 text-sm text-orange-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  This request exceeds the monthly quota — some days will be Loss of Pay.
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="manager-note">Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea id="manager-note" placeholder="Add a note for the employee..."
                  className="resize-none min-h-[80px]"
                  value={managerNote}
                  onChange={e => setManagerNote(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setReviewLeave(null); setManagerNote(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={updateLeave.isPending} onClick={() => handleReview("rejected")}>
              {updateLeave.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-1" /> Reject</>}
            </Button>
            <Button disabled={updateLeave.isPending} onClick={() => handleReview("approved")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white">
              {updateLeave.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1" /> Approve</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}