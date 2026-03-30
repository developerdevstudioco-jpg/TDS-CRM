import { useState } from "react";
import { useTemplates, useCreateTemplate, useDeleteTemplate } from "@/hooks/use-templates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquareQuote, Plus, Trash2, Loader2 } from "lucide-react";
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Message Templates</h1>
          <p className="text-muted-foreground mt-1">Create reusable templates for quick communication.</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="hover-elevate">
              <Plus className="h-4 w-4 mr-2" /> New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSave}>
              <DialogHeader>
                <DialogTitle>Create Template</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Welcome Message" 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">Message Content</Label>
                  <Textarea 
                    id="content" 
                    className="min-h-[150px] resize-none"
                    placeholder="Hello {{name}}, welcome to {{company}}!" 
                    required 
                    value={formData.content} 
                    onChange={e => setFormData({...formData, content: e.target.value})} 
                  />
                  <p className="text-xs text-muted-foreground">Available variables: {'{{name}}, {{company}}, {{status}}'}</p>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createTemplate.isPending}>
                  {createTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Template"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : templates?.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center bg-card border border-border/50 rounded-xl shadow-sm">
          <MessageSquareQuote className="h-12 w-12 mb-4 text-muted-foreground/30" />
          <p className="text-lg font-medium">No templates yet</p>
          <p className="text-muted-foreground mt-1">Create your first template to start sending quick messages.</p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {templates?.map((template) => (
            <Card key={template.id} className="border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-display">{template.name}</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-2 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="bg-muted/30 rounded-lg p-4 h-full text-sm text-foreground whitespace-pre-wrap font-body leading-relaxed">
                  {template.content}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
