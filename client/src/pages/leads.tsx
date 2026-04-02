import { useState, useRef, useEffect } from "react";
import { useSearch } from "wouter";
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead, useUploadCsv, useBulkUpdateLeads } from "@/hooks/use-leads";
import { useLeadActivities, useCreateLeadActivity } from "@/hooks/use-lead-activities";
import { useUsers } from "@/hooks/use-users";
import { useTemplates } from "@/hooks/use-templates";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search, Plus, MoreVertical, Upload, Trash2, Edit2, MessageCircle, MessageSquare, Phone,
  Loader2, FileDown, ClipboardList, StickyNote, ArrowRightLeft, Clock, Users,
  ChevronDown, X, CalendarClock, Filter, Calendar, Send, PenLine, MessageSquareText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type Lead } from "@shared/schema";
import { type LeadWithUser } from "@shared/routes";
import { MessageDialog } from "@/components/message-dialog";
import { Badge } from "@/components/ui/badge";

const STATUSES = ['Open', 'Cold', 'Warm', 'Will Convert', 'Not Interested', 'Converted'];

type FollowUpFilter = 'all' | 'today' | 'tomorrow' | 'overdue';

function getToday() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function getTomorrow() {
  const d = getToday(); d.setDate(d.getDate() + 1); return d;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function toDateInputValue(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().split("T")[0];
}
function formatFollowUp(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = getToday();
  const tomorrow = getTomorrow();
  if (isSameDay(d, today)) return { label: "Today", color: "text-sky-600 bg-sky-50 border-sky-200" };
  if (isSameDay(d, tomorrow)) return { label: "Tomorrow", color: "text-indigo-600 bg-indigo-50 border-indigo-200" };
  d.setHours(0, 0, 0, 0);
  if (d < today) return { label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), color: "text-red-600 bg-red-50 border-red-200" };
  return { label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }), color: "text-green-600 bg-green-50 border-green-200" };
}

function StatusBadge({ status }: { status: string }) {
  const getColors = () => {
    switch(status) {
      case 'Open': return 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200';
      case 'Warm': return 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200';
      case 'Converted': return 'bg-green-100 text-green-700 hover:bg-green-100 border-green-200';
      case 'Not Interested': return 'bg-red-100 text-red-700 hover:bg-red-100 border-red-200';
      case 'Will Convert': return 'bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200';
      case 'Cold': return 'bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200';
      default: return 'bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200';
    }
  };
  return <Badge variant="outline" className={`font-medium ${getColors()}`}>{status}</Badge>;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function ActivityIcon({ type }: { type: string }) {
  if (type === 'status_change') return <ArrowRightLeft className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />;
  if (type === 'note') return <StickyNote className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />;
  return <ClipboardList className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />;
}

function InlineStatusCell({ lead, onUpdate }: { lead: LeadWithUser; onUpdate: (id: number, val: string) => void }) {
  return (
    <Select value={lead.status} onValueChange={(val) => onUpdate(lead.id, val)}>
      <SelectTrigger
        className="border-transparent bg-transparent shadow-none h-auto p-0 w-auto gap-1 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-50"
        data-testid={`select-status-${lead.id}`}
      >
        <StatusBadge status={lead.status} />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map(s => (
          <SelectItem key={s} value={s}>
            <StatusBadge status={s} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InlineFollowUpCell({ lead, onUpdate }: { lead: LeadWithUser; onUpdate: (id: number, val: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [tempDate, setTempDate] = useState("");
  const followUp = formatFollowUp(lead.followUpDate);

  const handleOpen = () => {
    setTempDate(toDateInputValue(lead.followUpDate));
    setEditing(true);
  };

  const handleBlur = () => {
    onUpdate(lead.id, tempDate || null);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={tempDate}
          onChange={(e) => setTempDate(e.target.value)}
          onBlur={handleBlur}
          autoFocus
          className="h-7 text-xs border border-border rounded px-1.5 bg-background w-32 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onMouseDown={(e) => { e.preventDefault(); onUpdate(lead.id, null); setEditing(false); }}
          className="text-muted-foreground hover:text-destructive p-0.5"
          title="Clear date"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleOpen}
      className="cursor-pointer hover:opacity-80 transition-opacity text-left"
      data-testid={`btn-followup-${lead.id}`}
    >
      {followUp ? (
        <Badge variant="outline" className={`text-xs font-medium ${followUp.color}`}>
          <Calendar className="h-3 w-3 mr-1" />
          {followUp.label}
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
          <Calendar className="h-3 w-3" /> Set date
        </span>
      )}
    </button>
  );
}

function InlineAssignedCell({ lead, users, onUpdate }: {
  lead: LeadWithUser;
  users: Array<{ id: number; username: string }>;
  onUpdate: (id: number, val: number | null) => void;
}) {
  return (
    <Select
      value={String(lead.assignedTo ?? 'none')}
      onValueChange={(val) => onUpdate(lead.id, val === 'none' ? null : Number(val))}
    >
      <SelectTrigger
        className="border-transparent bg-transparent shadow-none h-auto p-0 w-auto gap-1 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-50"
        data-testid={`select-assigned-${lead.id}`}
      >
        {lead.assignedUsername ? (
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {lead.assignedUsername.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{lead.assignedUsername}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Unassigned</span>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none"><span className="text-muted-foreground">Unassigned</span></SelectItem>
        {users.map(u => (
          <SelectItem key={u.id} value={String(u.id)}>
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px]">{u.username.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              {u.username}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}


// Replaces variables in template content with lead data
function fillTemplate(content: string, lead: LeadWithUser): string {
  return content
    .replace(/\{\{name\}\}/g, lead.name || '')
    .replace(/\{\{company\}\}/g, lead.company || '')
    .replace(/\{\{status\}\}/g, lead.status || '');
}

function MessagePickerDialog({ lead, type, onClose, onSent }: {
  lead: LeadWithUser;
  type: 'whatsapp' | 'sms';
  onClose: () => void;
  onSent: (type: 'whatsapp' | 'sms', msg: string) => void;
}) {
  const { data: templates, isLoading } = useTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | 'custom' | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');

  const isWhatsApp = type === 'whatsapp';

  const handleSelectTemplate = (id: number | 'custom') => {
    setSelectedTemplateId(id);
    if (id === 'custom') {
      setPreviewMessage(customMessage);
    } else {
      const template = templates?.find(t => t.id === id);
      if (template) setPreviewMessage(fillTemplate(template.content, lead));
    }
  };

  const handleSend = () => {
    const msg = selectedTemplateId === 'custom' ? customMessage : previewMessage;
    if (!msg.trim()) return;
    const encodedMsg = encodeURIComponent(msg);
    const number = lead.mobile.replace(/\D/g, '');
    if (isWhatsApp) {
      window.open(`https://wa.me/${number}?text=${encodedMsg}`, '_blank');
      onSent('whatsapp', msg);
    } else {
      window.open(`sms:${lead.mobile}?body=${encodedMsg}`, '_blank');
      onSent('sms', msg);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] bg-card border-white/10">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            {isWhatsApp
              ? <><MessageCircle className="h-5 w-5 text-green-400" /> Send WhatsApp</>
              : <><MessageSquare className="h-5 w-5 text-blue-400" /> Send SMS</>
            }
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* To */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-white/5 rounded-xl px-4 py-2.5 border border-white/8">
            <span className="font-medium text-foreground">To:</span>
            <span>{lead.name}</span>
            <span className="text-muted-foreground">·</span>
            <span>{lead.mobile}</span>
          </div>

          {/* Template list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Choose a template</p>
            {isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {/* Custom message option */}
                <button
                  onClick={() => handleSelectTemplate('custom')}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                    selectedTemplateId === 'custom'
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-white/3 border-white/8 text-foreground hover:bg-white/6 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <PenLine className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium">Custom Message</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-6">Type your own message</p>
                </button>

                {templates?.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                      selectedTemplateId === template.id
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-white/3 border-white/8 text-foreground hover:bg-white/6 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-medium">{template.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-6 line-clamp-1">{template.content}</p>
                  </button>
                ))}

                {templates?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No templates yet. Use Custom Message.</p>
                )}
              </div>
            )}
          </div>

          {/* Message preview / custom input */}
          {selectedTemplateId !== null && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {selectedTemplateId === 'custom' ? 'Your Message' : 'Preview'}
              </p>
              {selectedTemplateId === 'custom' ? (
                <Textarea
                  placeholder="Type your message..."
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  className="resize-none bg-white/5 border-white/10 focus:border-primary/50 text-sm"
                  rows={4}
                  autoFocus
                />
              ) : (
                <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {previewMessage}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground">Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={
              selectedTemplateId === null ||
              (selectedTemplateId === 'custom' && !customMessage.trim())
            }
            className={isWhatsApp
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
            }
          >
            <Send className="h-4 w-4 mr-2" />
            {isWhatsApp ? 'Send via WhatsApp' : 'Send via SMS'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeadDetailPanel({ lead, onClose, onLeadUpdated }: {
  lead: LeadWithUser; onClose: () => void; onLeadUpdated: () => void;
}) {
  const { data: activities, isLoading: activitiesLoading } = useLeadActivities(lead.id);
  const createActivity = useCreateLeadActivity(lead.id);
  const updateLead = useUpdateLead();
  const { toast } = useToast();

  const [noteText, setNoteText] = useState("");
  const [newStatus, setNewStatus] = useState(lead.status);
  const [newFollowUpDate, setNewFollowUpDate] = useState(toDateInputValue(lead.followUpDate));
  const [isUpdating, setIsUpdating] = useState(false);
  const [msgPickerType, setMsgPickerType] = useState<'whatsapp' | 'sms' | null>(null);

  const handleStatusChange = async () => {
    if (newStatus === lead.status) return;
    setIsUpdating(true);
    try {
      await updateLead.mutateAsync({ id: lead.id, status: newStatus });
      onLeadUpdated();
      toast({ title: "Status updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setIsUpdating(false); }
  };

  const handleFollowUpUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateLead.mutateAsync({
        id: lead.id,
        followUpDate: newFollowUpDate ? new Date(newFollowUpDate + 'T00:00:00').toISOString() : null
      });
      onLeadUpdated();
      toast({ title: "Follow-up date updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setIsUpdating(false); }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    try {
      await createActivity.mutateAsync({ type: 'note', content: noteText.trim() });
      setNoteText("");
      toast({ title: "Note added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-3 pb-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Mobile</p><p className="font-medium mt-0.5">{lead.mobile}</p></div>
          <div><p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Email</p><p className="font-medium mt-0.5">{lead.email || '—'}</p></div>
          <div><p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Company</p><p className="font-medium mt-0.5">{lead.company || '—'}</p></div>
          <div><p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Assigned To</p><p className="font-medium mt-0.5">{lead.assignedUsername || '—'}</p></div>
          <div className="col-span-2"><p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Current Status</p><div className="mt-0.5"><StatusBadge status={lead.status} /></div></div>
        </div>
      </div>
      <Separator />
      {/* Quick Actions */}
      <div className="py-4 grid grid-cols-3 gap-2">
        <a
          href={`tel:${lead.mobile}`}
          onClick={() => createActivity.mutate({ type: 'call', content: `Called ${lead.mobile}` })}
          className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 hover:bg-emerald-400/20 transition-colors"
        >
          <Phone className="h-5 w-5" />
          <span className="text-xs font-medium">Call</span>
        </a>
        <button
          onClick={() => { setMsgPickerType('whatsapp'); }}
          className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-green-400/10 border border-green-400/20 text-green-400 hover:bg-green-400/20 transition-colors"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-xs font-medium">WhatsApp</span>
        </button>
        <button
          onClick={() => setMsgPickerType('sms')}
          className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-blue-400/10 border border-blue-400/20 text-blue-400 hover:bg-blue-400/20 transition-colors"
        >
          <MessageSquare className="h-5 w-5" />
          <span className="text-xs font-medium">SMS</span>
        </button>
      </div>
      {msgPickerType && (
        <MessagePickerDialog
          lead={lead}
          type={msgPickerType}
          onClose={() => setMsgPickerType(null)}
          onSent={(type, msg) => {
            createActivity.mutate({
              type,
              content: `${type === 'whatsapp' ? 'WhatsApp' : 'SMS'} sent to ${lead.mobile}: ${msg.substring(0, 60)}${msg.length > 60 ? '...' : ''}`
            });
          }}
        />
      )}
      <Separator />
      <div className="py-4 space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Change Status</h4>
        <div className="flex gap-2">
          <Select value={newStatus} onValueChange={setNewStatus}>
            <SelectTrigger className="flex-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" onClick={handleStatusChange} disabled={newStatus === lead.status || isUpdating}>
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
          </Button>
        </div>
      </div>
      <Separator />
      <div className="py-4 space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Follow-up Date</h4>
        <div className="flex gap-2">
          <Input type="date" value={newFollowUpDate} onChange={e => setNewFollowUpDate(e.target.value)} className="flex-1 h-9" />
          <Button size="sm" onClick={handleFollowUpUpdate} disabled={isUpdating}>
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set"}
          </Button>
          {newFollowUpDate && (
            <Button size="sm" variant="ghost" onClick={() => setNewFollowUpDate("")} className="text-muted-foreground px-2">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <Separator />
      <div className="py-4 space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><StickyNote className="h-4 w-4" /> Add Note</h4>
        <form onSubmit={handleAddNote} className="flex flex-col gap-2">
          <Textarea placeholder="Write a note about this lead..." value={noteText} onChange={e => setNoteText(e.target.value)} className="resize-none text-sm" rows={3} />
          <Button type="submit" size="sm" className="self-end" disabled={!noteText.trim() || createActivity.isPending}>
            {createActivity.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Note"}
          </Button>
        </form>
      </div>
      <Separator />
      <div className="py-4 flex-1 overflow-hidden flex flex-col">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3"><Clock className="h-4 w-4" /> Activity History</h4>
        {activitiesLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !activities?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">No activity yet.</p>
        ) : (
          <div className="space-y-3 overflow-y-auto pr-1">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-2.5 text-sm">
                <ActivityIcon type={activity.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground leading-snug">{activity.content}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {activity.username && <span className="text-xs text-muted-foreground font-medium">{activity.username}</span>}
                    <span className="text-xs text-muted-foreground">{formatDate(activity.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BulkActionBar({ selectedCount, onClearSelection, onBulkStatusChange, onBulkAssign, onBulkDelete, users, isPending }: {
  selectedCount: number; onClearSelection: () => void;
  onBulkStatusChange: (status: string) => void;
  onBulkAssign: (userId: number | null) => void;
  onBulkDelete: () => void;
  users: Array<{ id: number; username: string }>; isPending: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg flex-wrap">
      <div className="flex items-center gap-2 mr-2">
        <span className="text-sm font-semibold text-primary">{selectedCount} selected</span>
        <button onClick={onClearSelection} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <Separator orientation="vertical" className="h-5" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1" disabled={isPending}>
            <ArrowRightLeft className="h-3.5 w-3.5" /> Change Status <ChevronDown className="h-3.5 w-3.5 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {STATUSES.map(s => <DropdownMenuItem key={s} onClick={() => onBulkStatusChange(s)}><StatusBadge status={s} /></DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
      {users.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1" disabled={isPending}>
              <Users className="h-3.5 w-3.5" /> Assign To <ChevronDown className="h-3.5 w-3.5 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onBulkAssign(null)}><span className="text-muted-foreground">Unassigned</span></DropdownMenuItem>
            {users.map(u => (
              <DropdownMenuItem key={u.id} onClick={() => onBulkAssign(u.id)}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5"><AvatarFallback className="text-[10px]">{u.username.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  {u.username}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button
        variant="outline" size="sm"
        className="h-8 gap-1 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
        onClick={onBulkDelete}
        disabled={isPending}
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete Selected
      </Button>
      {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

export default function Leads() {
  const search = useSearch();
  const { data: leads, isLoading, refetch } = useLeads();
  const { data: users } = useUsers();
  const { user: currentUser } = useAuth();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const uploadCsv = useUploadCsv();
  const bulkUpdate = useBulkUpdateLeads();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadWithUser | null>(null);
  const [detailLead, setDetailLead] = useState<LeadWithUser | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messageLead, setMessageLead] = useState<Lead | null>(null);
  const [messageType, setMessageType] = useState<'whatsapp' | 'sms' | null>(null);

  const [formData, setFormData] = useState({
    name: "", mobile: "", email: "", company: "", status: "Open",
    assignedTo: "" as string | number, followUpDate: ""
  });

  // Apply filters from URL query params on mount
  useEffect(() => {
    const params = new URLSearchParams(search);
    const s = params.get('status');
    const f = params.get('followup') as FollowUpFilter | null;
    if (s) setStatusFilter(s);
    if (f) setFollowUpFilter(f);
  }, []);

  const today = getToday();
  const tomorrow = getTomorrow();

  const filteredLeads = (leads || []).filter(l => {
    const matchesSearch = !searchTerm ||
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.mobile.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    let matchesFollowUp = true;
    if (followUpFilter === 'today') {
      matchesFollowUp = !!l.followUpDate && isSameDay(new Date(l.followUpDate), today);
    } else if (followUpFilter === 'tomorrow') {
      matchesFollowUp = !!l.followUpDate && isSameDay(new Date(l.followUpDate), tomorrow);
    } else if (followUpFilter === 'overdue') {
      if (!l.followUpDate) { matchesFollowUp = false; }
      else { const d = new Date(l.followUpDate); d.setHours(0, 0, 0, 0); matchesFollowUp = d < today; }
    }
    return matchesSearch && matchesStatus && matchesFollowUp;
  });

  const isAllSelected = filteredLeads.length > 0 && filteredLeads.every(l => selectedIds.has(l.id));
  const isPartiallySelected = filteredLeads.some(l => selectedIds.has(l.id)) && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredLeads.map(l => l.id)));
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleBulkStatusChange = async (status: string) => {
    try {
      const res = await bulkUpdate.mutateAsync({ ids: Array.from(selectedIds), updates: { status } });
      toast({ title: `Updated ${res.count} leads to "${status}"` });
      setSelectedIds(new Set());
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleBulkAssign = async (userId: number | null) => {
    try {
      const res = await bulkUpdate.mutateAsync({ ids: Array.from(selectedIds), updates: { assignedTo: userId } });
      const name = userId ? users?.find(u => u.id === userId)?.username : 'Unassigned';
      toast({ title: `Assigned ${res.count} leads to ${name}` });
      setSelectedIds(new Set());
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected lead(s)? This cannot be undone.`)) return;
    let count = 0;
    try {
      for (const id of selectedIds) {
        await deleteLead.mutateAsync(id);
        count++;
      }
      toast({ title: `Deleted ${count} lead(s)` });
      if (detailLead && selectedIds.has(detailLead.id)) setDetailLead(null);
      setSelectedIds(new Set());
    } catch (err: any) { toast({ title: "Error deleting", description: err.message, variant: "destructive" }); }
  };

  const handleInlineStatusUpdate = async (id: number, status: string) => {
    try {
      await updateLead.mutateAsync({ id, status });
      if (detailLead?.id === id) setDetailLead(prev => prev ? { ...prev, status } : null);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleInlineFollowUpUpdate = async (id: number, date: string | null) => {
    try {
      const followUpDate = date ? new Date(date + 'T00:00:00').toISOString() : null;
      await updateLead.mutateAsync({ id, followUpDate });
      if (detailLead?.id === id) setDetailLead(prev => prev ? { ...prev, followUpDate } : null);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleInlineAssignedUpdate = async (id: number, assignedTo: number | null) => {
    try {
      await updateLead.mutateAsync({ id, assignedTo });
      const result = await refetch();
      if (detailLead?.id === id && result.data) {
        const updated = result.data.find(l => l.id === id);
        if (updated) setDetailLead(updated);
      }
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        assignedTo: formData.assignedTo === "" || formData.assignedTo === "none" ? null : Number(formData.assignedTo),
        followUpDate: formData.followUpDate ? new Date(formData.followUpDate + 'T00:00:00').toISOString() : null,
      };
      if (editingLead) {
        await updateLead.mutateAsync({ id: editingLead.id, ...payload });
        toast({ title: "Lead updated successfully" });
      } else {
        await createLead.mutateAsync(payload);
        toast({ title: "Lead created successfully" });
      }
      setIsAddOpen(false);
      setEditingLead(null);
      setFormData({ name: "", mobile: "", email: "", company: "", status: "Open", assignedTo: "", followUpDate: "" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const openEdit = (lead: LeadWithUser) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name, mobile: lead.mobile, email: lead.email || "", company: lead.company || "",
      status: lead.status, assignedTo: lead.assignedTo ?? "",
      followUpDate: toDateInputValue(lead.followUpDate),
    });
    setIsAddOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      await deleteLead.mutateAsync(id);
      if (detailLead?.id === id) setDetailLead(null);
      selectedIds.delete(id); setSelectedIds(new Set(selectedIds));
      toast({ title: "Lead deleted" });
    } catch (err: any) { toast({ title: "Error deleting", description: err.message, variant: "destructive" }); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadCsv.mutateAsync(file);
      toast({ title: "Upload complete", description: `Imported ${res.count} leads successfully.` });
    } catch (err: any) { toast({ title: "Upload failed", description: err.message, variant: "destructive" }); }
    finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const usersList = isAdminOrManager ? (users || []) : [];
  const activeFiltersCount = (statusFilter !== 'all' ? 1 : 0) + (followUpFilter !== 'all' ? 1 : 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Leads Management</h1>
          <p className="text-muted-foreground mt-1">Add, update, and communicate with your prospects.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
          <Button variant="outline" className="bg-background" onClick={() => fileInputRef.current?.click()} disabled={uploadCsv.isPending}>
            {uploadCsv.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Import CSV
          </Button>
          <Button className="hover-elevate" onClick={() => {
            setEditingLead(null);
            setFormData({ name: "", mobile: "", email: "", company: "", status: "Open", assignedTo: "", followUpDate: "" });
            setIsAddOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" /> Add Lead
          </Button>
        </div>
      </div>

      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditingLead(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editingLead ? 'Edit Lead' : 'Create New Lead'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number *</Label>
                <Input id="mobile" required value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} placeholder="+1234567890" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="followUpDate">Follow-up Date</Label>
                  <Input id="followUpDate" type="date" value={formData.followUpDate} onChange={e => setFormData({...formData, followUpDate: e.target.value})} />
                </div>
              </div>
              {isAdminOrManager && (
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select
                    value={String(formData.assignedTo || "none")}
                    onValueChange={(val) => setFormData({...formData, assignedTo: val === "none" ? "" : Number(val)})}
                  >
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {usersList.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.username}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createLead.isPending || updateLead.isPending}>Save Lead</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onClearSelection={() => setSelectedIds(new Set())}
          onBulkStatusChange={handleBulkStatusChange}
          onBulkAssign={handleBulkAssign}
          onBulkDelete={handleBulkDelete}
          users={usersList}
          isPending={bulkUpdate.isPending || deleteLead.isPending}
        />
      )}

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="p-4 border-b border-border/40 bg-muted/10 flex flex-col gap-3 space-y-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search leads..." className="pl-9 bg-white/5 border-white/10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-white/5 border-white/10 h-9 text-sm" data-testid="select-filter-status">
                <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={followUpFilter} onValueChange={(v) => setFollowUpFilter(v as FollowUpFilter)}>
              <SelectTrigger className="w-44 bg-white/5 border-white/10 h-9 text-sm" data-testid="select-filter-followup">
                <CalendarClock className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Follow-up" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Follow-ups</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-foreground" onClick={() => { setStatusFilter('all'); setFollowUpFilter('all'); }}>
                <X className="h-3.5 w-3.5 mr-1" /> Clear filters
                <Badge variant="secondary" className="ml-1 h-4 w-4 rounded-full p-0 flex items-center justify-center text-[10px]">{activeFiltersCount}</Badge>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <FileDown className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-lg font-medium text-foreground">No leads found</p>
              <p className="text-sm">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/5">
                  <TableRow>
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        checked={isAllSelected ? true : isPartiallySelected ? "indeterminate" : false}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="font-semibold text-foreground">Name</TableHead>
                    <TableHead className="font-semibold text-foreground">Contact</TableHead>
                    <TableHead className="font-semibold text-foreground">Company</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="font-semibold text-foreground">Follow-up</TableHead>
                    <TableHead className="font-semibold text-foreground">Assigned To</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className={`group hover:bg-muted/30 transition-colors ${selectedIds.has(lead.id) ? 'bg-primary/5' : ''}`}
                      data-testid={`row-lead-${lead.id}`}
                    >
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={() => toggleSelect(lead.id)}
                          aria-label={`Select ${lead.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          className="font-medium text-left hover:text-primary hover:underline transition-colors cursor-pointer"
                          onClick={() => setDetailLead(lead)}
                        >
                          {lead.name}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{lead.mobile}</div>
                        <div className="text-xs text-muted-foreground">{lead.email}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{lead.company || '-'}</TableCell>
                      <TableCell>
                        <InlineStatusCell lead={lead} onUpdate={handleInlineStatusUpdate} />
                      </TableCell>
                      <TableCell>
                        <InlineFollowUpCell lead={lead} onUpdate={handleInlineFollowUpUpdate} />
                      </TableCell>
                      <TableCell>
                        {isAdminOrManager ? (
                          <InlineAssignedCell lead={lead} users={usersList} onUpdate={handleInlineAssignedUpdate} />
                        ) : (
                          lead.assignedUsername ? (
                            <div className="flex items-center gap-1.5">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                  {lead.assignedUsername.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{lead.assignedUsername}</span>
                            </div>
                          ) : <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-opacity"
                            onClick={() => handleDelete(lead.id)}
                            title="Delete lead"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => setDetailLead(lead)}>
                                <ClipboardList className="h-4 w-4 mr-2 text-muted-foreground" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(lead)}>
                                <Edit2 className="h-4 w-4 mr-2" /> Edit Lead
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setMessageLead(lead); setMessageType('whatsapp'); }}>
                                <MessageCircle className="h-4 w-4 mr-2 text-green-600" /> Send WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setMessageLead(lead); setMessageType('sms'); }}>
                                <MessageSquare className="h-4 w-4 mr-2 text-blue-600" /> Send SMS
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(lead.id)} className="text-destructive focus:text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!detailLead} onOpenChange={(open) => { if (!open) setDetailLead(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto" side="right">
          {detailLead && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="text-xl font-display">{detailLead.name}</SheetTitle>
              </SheetHeader>
              <LeadDetailPanel
                lead={detailLead}
                onClose={() => setDetailLead(null)}
                onLeadUpdated={() => {
                  refetch().then((result) => {
                    if (result.data) {
                      const updated = result.data.find(l => l.id === detailLead.id);
                      if (updated) setDetailLead(updated);
                    }
                  });
                }}
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      <MessageDialog
        isOpen={!!messageLead}
        onClose={() => { setMessageLead(null); setMessageType(null); }}
        lead={messageLead}
        type={messageType}
      />
    </div>
  );
}