import { useState } from "react";
import { useTemplates, useCreateTemplate, useDeleteTemplate } from "@/hooks/use-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquareQuote, Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Templates() {
  const { data: templates, isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", content: "" });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTemplate.mutateAsync(formData);
      toast({ title: "Template created successfully" });
      setIsOpen(false);
      setFormData({ name: "", content: "" });
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

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="hover-elevate bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4 mr-2" /> New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 shadow-2xl shadow-black/50">
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
                    className="min-h-[150px] resize-none bg-white/5 border-white/10 focus:border-primary/50"
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
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createTemplate.isPending}
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
          {templates?.map((template) => (
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}