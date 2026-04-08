import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'sop' | 'checklist';
  department?: string;
  category?: string;
  sopContext?: string;
  onGenerated: (result: any) => void;
}

export function AIGenerateDialog({ open, onOpenChange, type, department, category, onGenerated }: AIGenerateDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-draft-knowledge', {
        body: { type, prompt: prompt.trim(), department, category },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      onGenerated(data);
      toast({ title: `${type === 'sop' ? 'SOP steps' : 'Checklist items'} generated!` });
      onOpenChange(false);
      setPrompt('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Generation failed', description: e.message });
    }
    setGenerating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Generate {type === 'sop' ? 'SOP' : 'Checklist'}
          </DialogTitle>
          <DialogDescription>
            Describe what you need or paste rough notes — AI will structure it into {type === 'sop' ? 'detailed steps' : 'checklist items'}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>What do you need?</Label>
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={type === 'sop'
                ? 'e.g., "How to set up the Barudan for a left-chest logo on a polo" or paste your rough notes here...'
                : 'e.g., "QC checklist for embroidery hats" or paste a rough list of items to structure...'}
              rows={5}
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating || !prompt.trim()}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
