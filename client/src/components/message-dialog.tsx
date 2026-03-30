import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTemplates } from "@/hooks/use-templates";
import { type Lead } from "@shared/schema";
import { Loader2, MessageCircle, Send } from "lucide-react";

interface MessageDialogProps {
  lead: Lead | null;
  type: 'whatsapp' | 'sms' | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MessageDialog({ lead, type, isOpen, onClose }: MessageDialogProps) {
  const { data: templates, isLoading } = useTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [customMessage, setCustomMessage] = useState("");

  if (!lead || !type) return null;

  const selectedTemplate = templates?.find(t => t.id.toString() === selectedTemplateId);
  
  // Replace variables like {{name}} or {{company}}
  const processTemplate = (content: string) => {
    return content
      .replace(/\{\{name\}\}/gi, lead.name)
      .replace(/\{\{company\}\}/gi, lead.company || 'your company')
      .replace(/\{\{status\}\}/gi, lead.status);
  };

  const finalMessage = selectedTemplate ? processTemplate(selectedTemplate.content) : customMessage;

  const handleSend = () => {
    if (!finalMessage) return;
    
    const encodedText = encodeURIComponent(finalMessage);
    const cleanMobile = lead.mobile.replace(/\D/g, '');

    if (type === 'whatsapp') {
      window.open(`https://wa.me/${cleanMobile}?text=${encodedText}`, '_blank');
    } else {
      window.open(`sms:${cleanMobile}?body=${encodedText}`, '_blank');
    }
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Send {type === 'whatsapp' ? 'WhatsApp' : 'SMS'} to {lead.name}
          </DialogTitle>
          <DialogDescription>
            Select a template or write a custom message to send.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Select Template</Label>
            {isLoading ? (
              <div className="flex h-10 items-center justify-center border rounded-md border-border bg-muted/20">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Custom Message</SelectItem>
                  {templates?.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Message Preview</Label>
            <Textarea
              className="min-h-[120px] resize-none"
              placeholder="Type your message here..."
              value={finalMessage}
              onChange={(e) => {
                if (!selectedTemplate) {
                  setCustomMessage(e.target.value);
                }
              }}
              readOnly={!!selectedTemplate}
            />
            {!!selectedTemplate && (
              <p className="text-xs text-muted-foreground">
                Clear template selection to edit message manually.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSend} 
            disabled={!finalMessage}
            className="hover-elevate gap-2"
          >
            <Send className="h-4 w-4" />
            Open App
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
