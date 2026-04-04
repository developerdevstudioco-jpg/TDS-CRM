import { useState, useRef } from "react";
import { useTemplates, useCreateTemplate, useDeleteTemplate } from "@/hooks/use-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquareQuote, Plus, Trash2, Loader2, Sparkles, FileText, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Templates() {
  const { data: templates, isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", content: "", pdfUrl: "", pdfName: "" });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Only PDF files allowed", variant: "destructive" });
      return;
    }
    setPdfFile(file);
    setIsUploadingPdf(true);
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const res = await fetch("/api/templates/upload-pdf", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTemplate.mutateAsync({
        name: formData.name,
        content: formData.content,
        pdfUrl: formData.pdfUrl || undefined,
        pdfName: formData.pdfName || undefined,
      } as any);
      toast({ title: "Template created successfully" });
      setIsOpen(false);
      setFormData({ name: "", content: "", pdfUrl: "", pdfName: "" });
      setPdfFile(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this template?")) {
      try {
        await deleteTemplate.mutateAsync(id);
        toast({ title: "Template deleted" });
      } catch (err: any) {
        toast({ title: "Error deleting", description: err.message, variant: "destructive" });
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground mt-1 text-sm">Create reusable message templates for quick communication.</p>
        </div>

        <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) { setFormData({ name: "", content: "", pdfUrl: "", pdfName: "" }); setPdfFile(null); } }}>
          <DialogTrigger asChild>
            <Button className="hover-elevate bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4 mr-2" /> New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSave}>
              <DialogHeader>
                <DialogTitle className="font-display">Create Template</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Template Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Welcome Message"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="bg-white/5 border-white/10 focus:border-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Message Content</Label>
                  <Textarea
                    id="content"
                    className="min-h-[120px] resize-none bg-white/5 border-white/10 focus:border-primary/50"
                    placeholder="Hello {{name}}, welcome to {{company}}!"
                    required
                    value={formData.content}
                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                  />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                    <Sparkles className="h-3 w-3 text-primary" />
                    Variables: <code className="text-primary">{'{{name}}'}</code>, <code className="text-primary">{'{{company}}'}</code>, <code className="text-primary">{'{{status}}'}</code>
                  </div>
                </div>

                {/* PDF Upload */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Attach PDF (optional)</Label>
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handlePdfSelect}
                  />
                  {!pdfFile ? (
                    <button
                      type="button"
                      onClick={() => pdfInputRef.current?.click()}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-white/20 bg-white/3 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-white/5 transition-all duration-200"
                    >
                      <Upload className="h-4 w-4 shrink-0" />
                      <span className="text-sm">Click to upload PDF</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5">
                      {isUploadingPdf ? (
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-400 shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                      )}
                      <span className="text-sm text-emerald-400 flex-1 truncate">{pdfFile.name}</span>
                      <button type="button" onClick={removePdf} className="text-muted-foreground hover:text-destructive p-1">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {pdfFile && formData.pdfUrl && (
                    <p className="text-xs text-emerald-400/70">✓ PDF link will be included in WhatsApp message</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createTemplate.isPending || isUploadingPdf}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {createTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Template"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
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
            <div
              key={template.id}
              className="group relative rounded-2xl border border-white/8 bg-card p-5 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 hover:border-white/15"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <MessageSquareQuote className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold text-sm text-foreground leading-tight">{template.name}</h3>
                </div>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Content */}
              <div className="bg-white/3 border border-white/6 rounded-xl p-4 flex-1">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed font-body">
                  {template.content}
                </p>
              </div>

              {/* PDF badge */}
              {template.pdfUrl && (
                <a
                  href={template.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 hover:bg-red-400/20 transition-colors text-xs font-medium"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{template.pdfName || "View PDF"}</span>
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}