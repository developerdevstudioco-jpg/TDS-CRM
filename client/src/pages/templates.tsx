import { useState, useRef, useMemo } from "react";
import { useTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from "@/hooks/use-templates";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  MessageSquareQuote, Plus, Trash2, Loader2, Sparkles, FileText,
  Upload, X, Edit2, Radio, Search, CheckSquare, Square, Send,
  Users, ChevronDown, MessageCircle, Puzzle, AlertTriangle, CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const LEAD_STATUSES = ["All", "Open", "Warm", "Will Register", "Converted", "Not Interested", "Follow Up"];

// ── Leads hook ────────────────────────────────────────────────────────────────
function useLeads() {
  return useQuery({
    queryKey: ["/api/leads"],
    queryFn: async () => {
      const res = await fetch("/api/leads", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json() as Promise<Array<{
        id: number; name: string; mobile: string; company: string | null;
        status: string; assignedTo: number | null;
      }>>;
    },
  });
}

function buildMessage(template: any, lead: any): string {
  return template.content
    .replace(/\{\{name\}\}/g, lead.name || "")
    .replace(/\{\{company\}\}/g, lead.company || "")
    .replace(/\{\{status\}\}/g, lead.status || "");
}

// ── Detect if extension is installed ─────────────────────────────────────────
// The extension adds a custom attribute to <html> when active
function isExtensionInstalled(): boolean {
  return typeof (window as any).chrome !== "undefined"
    && typeof (window as any).chrome.runtime !== "undefined";
}

// Send queue to extension via chrome.runtime
function sendToExtension(queue: any[]): boolean {
  try {
    const c = (window as any).chrome;
    if (!c?.runtime?.sendMessage) return false;
    // Extension ID — user pastes this from chrome://extensions after installing
    const extId = localStorage.getItem("tds_crm_ext_id") || "";
    if (!extId) {
      // Try broadcasting to any listening extension (works when on same origin)
      c.runtime.sendMessage({ type: "START_BROADCAST", queue });
      return true;
    }
    c.runtime.sendMessage(extId, { type: "START_BROADCAST", queue });
    return true;
  } catch {
    return false;
  }
}

// ── Broadcast Tab ─────────────────────────────────────────────────────────────
function BroadcastTab({ templates }: { templates: any[] }) {
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { toast } = useToast();

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set());
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [showExtSetup, setShowExtSetup] = useState(false);
  const [extId, setExtId] = useState(() => localStorage.getItem("tds_crm_ext_id") || "");

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchStatus = statusFilter === "All" || lead.status === statusFilter;
      const matchSearch = !search ||
        lead.name.toLowerCase().includes(search.toLowerCase()) ||
        lead.mobile.includes(search) ||
        (lead.company || "").toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [leads, statusFilter, search]);

  const allSelected = filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.has(l.id));
  const someSelected = filteredLeads.some(l => selectedLeadIds.has(l.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedLeadIds(prev => { const n = new Set(prev); filteredLeads.forEach(l => n.delete(l.id)); return n; });
    } else {
      setSelectedLeadIds(prev => { const n = new Set(prev); filteredLeads.forEach(l => n.add(l.id)); return n; });
    }
  };

  const toggleLead = (id: number) => {
    setSelectedLeadIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const selectedLeads = leads.filter(l => selectedLeadIds.has(l.id));

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads) counts[l.status] = (counts[l.status] || 0) + 1;
    return counts;
  }, [leads]);

  const saveExtId = () => {
    localStorage.setItem("tds_crm_ext_id", extId);
    setShowExtSetup(false);
    toast({ title: "Extension ID saved" });
  };

  // ── Main broadcast handler ────────────────────────────────────────────────
  const handleBroadcast = async () => {
    if (!selectedTemplate || selectedLeads.length === 0) return;

    // Build queue
    const queue = selectedLeads.map(lead => ({
      phone: lead.mobile.replace(/\D/g, ""),
      name: lead.name,
      message: buildMessage(selectedTemplate, lead),
      pdfUrl: selectedTemplate.pdfUrl || null,
      origin: window.location.origin,
    }));

    // Try sending via extension first
    const extSent = sendToExtension(queue);

    if (extSent) {
      toast({
        title: `Broadcast started — ${queue.length} messages`,
        description: "Check the extension icon in your toolbar to monitor progress.",
      });
      setSentCount(queue.length);
      return;
    }

    // Fallback: sequential WhatsApp Web tabs (manual send, one by one)
    setIsSending(true);
    setSentCount(0);
    let count = 0;
    for (const item of queue) {
      let text = item.message;
      if (item.pdfUrl) {
        const fullUrl = item.pdfUrl.startsWith("http") ? item.pdfUrl : item.origin + item.pdfUrl;
        text += `\n\n📄 ${fullUrl}`;
      }
      window.open(`https://wa.me/${item.phone}?text=${encodeURIComponent(text)}`, "_blank");
      count++;
      setSentCount(count);
      await new Promise(r => setTimeout(r, 800));
    }
    setIsSending(false);
    toast({
      title: `${count} WhatsApp windows opened`,
      description: "Install the browser extension for fully automatic sending.",
    });
  };

  return (
    <div className="space-y-5">

      {/* Extension install banner */}
      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 flex items-start gap-3">
        <Puzzle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-400">Browser Extension Required for Auto-Send</p>
          <p className="text-xs text-muted-foreground mt-1">
            Without the extension, WhatsApp windows open but you must click Send manually.
            Install the extension for fully automatic sending.
          </p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <a
              href="/whatsapp-extension.zip"
              download
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-400 hover:bg-amber-400/25 transition-colors font-medium"
              onClick={(e) => {
                e.preventDefault();
                toast({
                  title: "Download the extension folder",
                  description: "Get the 'whatsapp-extension' folder from your project files and load it in Chrome.",
                });
              }}
            >
              📦 How to install
            </a>
            <button
              onClick={() => setShowExtSetup(p => !p)}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground transition-colors"
            >
              ⚙ Set Extension ID
            </button>
          </div>
          {showExtSetup && (
            <div className="mt-3 flex items-center gap-2">
              <input
                value={extId}
                onChange={e => setExtId(e.target.value)}
                placeholder="Paste Extension ID from chrome://extensions"
                className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
              />
              <button onClick={saveExtId}
                className="text-xs px-3 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors font-medium">
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Step 1 — Template */}
      <div className="rounded-2xl border border-white/8 bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">1</div>
          <p className="text-sm font-semibold">Select Template</p>
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates yet — create one first.</p>
        ) : (
          <div className="relative">
            <button onClick={() => setShowTemplateDropdown(p => !p)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${
                selectedTemplate ? "border-primary/30 bg-primary/5 text-foreground" : "border-white/10 bg-white/5 text-muted-foreground"
              }`}>
              <div className="flex items-center gap-2.5">
                <MessageSquareQuote className={`h-4 w-4 shrink-0 ${selectedTemplate ? "text-primary" : "text-muted-foreground"}`} />
                {selectedTemplate ? selectedTemplate.name : "Choose a template..."}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            {showTemplateDropdown && (
              <div className="absolute top-full mt-1 left-0 right-0 z-20 rounded-xl border border-white/10 bg-card shadow-xl shadow-black/40 overflow-hidden">
                {templates.map(t => (
                  <button key={t.id}
                    onClick={() => { setSelectedTemplateId(t.id); setShowTemplateDropdown(false); }}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${selectedTemplateId === t.id ? "bg-primary/5" : ""}`}>
                    <MessageSquareQuote className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{t.content}</p>
                    </div>
                    {t.pdfUrl && <FileText className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {selectedTemplate && (
          <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Preview</p>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{selectedTemplate.content}</p>
            {selectedTemplate.pdfUrl && (
              <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1">
                <FileText className="h-3 w-3" />{selectedTemplate.pdfName || "PDF attached"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2 — Leads */}
      <div className="rounded-2xl border border-white/8 bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">2</div>
            <p className="text-sm font-semibold">Select Leads</p>
          </div>
          {selectedLeadIds.size > 0 && (
            <span className="text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg">
              {selectedLeadIds.size} selected
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, mobile..."
              className="w-full pl-8 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40" />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {LEAD_STATUSES.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === s ? "bg-primary/15 border border-primary/30 text-primary" : "bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20"
                }`}>
                {s}{s !== "All" && statusCounts[s] ? <span className="ml-1 opacity-60">{statusCounts[s]}</span> : null}
              </button>
            ))}
          </div>
        </div>

        {/* Select all bar */}
        {filteredLeads.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/3 border border-white/6">
            <button onClick={toggleAll} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              {allSelected ? <CheckSquare className="h-4 w-4 text-primary" />
                : someSelected ? <CheckSquare className="h-4 w-4 text-primary/50" />
                : <Square className="h-4 w-4" />}
              {allSelected ? "Deselect all" : `Select all ${filteredLeads.length} leads`}
            </button>
            <span className="text-xs text-muted-foreground">{filteredLeads.length} shown</span>
          </div>
        )}

        {/* Lead list */}
        {leadsLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />No leads match the current filter
          </div>
        ) : (
          <div className="rounded-xl border border-white/8 overflow-hidden max-h-[360px] overflow-y-auto">
            {filteredLeads.map(lead => {
              const isSelected = selectedLeadIds.has(lead.id);
              const previewMsg = selectedTemplate ? buildMessage(selectedTemplate, lead) : null;
              return (
                <button key={lead.id} onClick={() => toggleLead(lead.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-white/5 last:border-0 ${isSelected ? "bg-primary/5" : "hover:bg-white/[0.03]"}`}>
                  {isSelected ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {lead.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{lead.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border shrink-0 ${
                        lead.status === "Converted" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                        : lead.status === "Will Register" ? "bg-blue-400/10 text-blue-400 border-blue-400/20"
                        : lead.status === "Warm" ? "bg-amber-400/10 text-amber-400 border-amber-400/20"
                        : lead.status === "Not Interested" ? "bg-red-400/10 text-red-400 border-red-400/20"
                        : "bg-white/10 text-muted-foreground border-white/10"
                      }`}>{lead.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.mobile}{lead.company ? ` · ${lead.company}` : ""}
                    </p>
                    {previewMsg && <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5 italic">{previewMsg}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 3 — Send */}
      <div className="rounded-2xl border border-white/8 bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">3</div>
          <p className="text-sm font-semibold">Send Broadcast</p>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${selectedTemplate ? "border-primary/20 bg-primary/5 text-primary" : "border-white/10 bg-white/5 text-muted-foreground"}`}>
            <MessageSquareQuote className="h-3.5 w-3.5" />
            {selectedTemplate ? selectedTemplate.name : "No template selected"}
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${selectedLeadIds.size > 0 ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-400" : "border-white/10 bg-white/5 text-muted-foreground"}`}>
            <Users className="h-3.5 w-3.5" />
            {selectedLeadIds.size > 0 ? `${selectedLeadIds.size} lead${selectedLeadIds.size > 1 ? "s" : ""} selected` : "No leads selected"}
          </div>
        </div>

        {isSending && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-primary">Opening WhatsApp for lead {sentCount} of {selectedLeads.length}...</span>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleBroadcast}
            disabled={!selectedTemplate || selectedLeadIds.size === 0 || isSending}
            className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 gap-2"
          >
            {isSending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
              : <><MessageCircle className="h-4 w-4" /> Send to {selectedLeadIds.size || 0} lead{selectedLeadIds.size !== 1 ? "s" : ""}</>}
          </Button>
          {selectedLeadIds.size > 0 && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setSelectedLeadIds(new Set())}>
              Clear selection
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          With extension: fully automatic. Without extension: WhatsApp opens for each lead — click Send once per contact.
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Templates() {
  const { data: templates, isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"templates" | "broadcast">("templates");
  const [isOpen, setIsOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [formData, setFormData] = useState({ name: "", content: "", pdfUrl: "", pdfName: "" });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { toast({ title: "Only PDF files allowed", variant: "destructive" }); return; }
    setPdfFile(file);
    setIsUploadingPdf(true);
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const res = await fetch("/api/upload/pdf", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setFormData(prev => ({ ...prev, pdfUrl: data.pdfUrl, pdfName: data.pdfName }));
      toast({ title: "PDF uploaded successfully" });
    } catch (err: any) {
      toast({ title: "PDF upload failed", description: err.message, variant: "destructive" });
      setPdfFile(null);
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const removePdf = () => {
    setPdfFile(null);
    setFormData(prev => ({ ...prev, pdfUrl: "", pdfName: "" }));
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  };

  const openEdit = (template: any) => {
    setEditingTemplate(template);
    setFormData({ name: template.name, content: template.content, pdfUrl: template.pdfUrl || "", pdfName: template.pdfName || "" });
    if (template.pdfUrl) setPdfFile({ name: template.pdfName || "Existing PDF" } as File);
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({ id: editingTemplate.id, name: formData.name, content: formData.content, pdfUrl: formData.pdfUrl || undefined, pdfName: formData.pdfName || undefined } as any);
        toast({ title: "Template updated successfully" });
      } else {
        await createTemplate.mutateAsync({ name: formData.name, content: formData.content, pdfUrl: formData.pdfUrl || undefined, pdfName: formData.pdfName || undefined } as any);
        toast({ title: "Template created successfully" });
      }
      setIsOpen(false); setEditingTemplate(null); setFormData({ name: "", content: "", pdfUrl: "", pdfName: "" }); setPdfFile(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this template?")) {
      try { await deleteTemplate.mutateAsync(id); toast({ title: "Template deleted" }); }
      catch (err: any) { toast({ title: "Error deleting", description: err.message, variant: "destructive" }); }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground mt-1 text-sm">Create and broadcast message templates to your leads.</p>
        </div>
        {activeTab === "templates" && (
          <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) { setEditingTemplate(null); setFormData({ name: "", content: "", pdfUrl: "", pdfName: "" }); setPdfFile(null); } }}>
            <DialogTrigger asChild>
              <Button className="hover-elevate bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4 mr-2" /> New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-white/10 shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSave}>
                <DialogHeader><DialogTitle className="font-display">{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Template Name</Label>
                    <Input id="name" placeholder="e.g. Welcome Message" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-white/5 border-white/10 focus:border-primary/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Message Content</Label>
                    <Textarea id="content" className="min-h-[120px] resize-none bg-white/5 border-white/10 focus:border-primary/50" placeholder="Hello {{name}}, welcome to {{company}}!" required value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })} />
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                      <Sparkles className="h-3 w-3 text-primary" />
                      Variables: <code className="text-primary">{'{{name}}'}</code>, <code className="text-primary">{'{{company}}'}</code>, <code className="text-primary">{'{{status}}'}</code>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Attach PDF (optional)</Label>
                    <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfSelect} />
                    {!pdfFile ? (
                      <button type="button" onClick={() => pdfInputRef.current?.click()} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-white/20 bg-white/3 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-white/5 transition-all duration-200">
                        <Upload className="h-4 w-4 shrink-0" /><span className="text-sm">Click to upload PDF</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5">
                        {isUploadingPdf ? <Loader2 className="h-4 w-4 animate-spin text-emerald-400 shrink-0" /> : <FileText className="h-4 w-4 text-emerald-400 shrink-0" />}
                        <span className="text-sm text-emerald-400 flex-1 truncate">{pdfFile.name}</span>
                        <button type="button" onClick={removePdf} className="text-muted-foreground hover:text-destructive p-1"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                    {pdfFile && formData.pdfUrl && <p className="text-xs text-emerald-400/70">✓ PDF link will be included in WhatsApp message</p>}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createTemplate.isPending || updateTemplate.isPending || isUploadingPdf} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    {createTemplate.isPending || updateTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingTemplate ? "Save Changes" : "Save Template"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab("templates")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === "templates" ? "bg-card border border-white/10 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <MessageSquareQuote className="h-4 w-4" /> Templates
        </button>
        <button onClick={() => setActiveTab("broadcast")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === "broadcast" ? "bg-card border border-white/10 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Radio className="h-4 w-4" /> Broadcast
          <span className="text-[10px] bg-emerald-400/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold">WhatsApp</span>
        </button>
      </div>

      {activeTab === "templates" && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : templates?.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center rounded-2xl border border-white/8 bg-card">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <MessageSquareQuote className="h-8 w-8 text-primary/50" />
              </div>
              <p className="text-lg font-display font-semibold">No templates yet</p>
              <p className="text-muted-foreground mt-1 text-sm max-w-xs">Create your first message template to start communicating quickly with your leads.</p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {templates?.map((template: any) => (
                <div key={template.id} className="group relative rounded-2xl border border-white/8 bg-card p-5 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 hover:border-white/15">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <MessageSquareQuote className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-display font-semibold text-sm text-foreground leading-tight">{template.name}</h3>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <button onClick={() => openEdit(template)} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200 shrink-0"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(template.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="bg-white/3 border border-white/6 rounded-xl p-4 flex-1">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed font-body">{template.content}</p>
                  </div>
                  {template.pdfUrl && (
                    <a href={template.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 hover:bg-red-400/20 transition-colors text-xs font-medium">
                      <FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{template.pdfName || "View PDF"}</span>
                    </a>
                  )}
                  <button onClick={() => setActiveTab("broadcast")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-emerald-400 transition-colors mt-auto pt-1">
                    <MessageCircle className="h-3.5 w-3.5" /> Use in Broadcast
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "broadcast" && <BroadcastTab templates={templates ?? []} />}
    </div>
  );
}