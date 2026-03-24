import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { useCustomerMessages } from '@/hooks/useCustomerMessages';
import { useAuth } from '@/hooks/useAuth';
import { Mail, MessageSquare, StickyNote, FileText, Sparkles, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Customer } from '@/hooks/useCustomers';

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  jobId?: string;
}

export function SendMessageDialog({ open, onOpenChange, customer, jobId }: SendMessageDialogProps) {
  const { user } = useAuth();
  const { templates } = useMessageTemplates();
  const { sendMessage, addNote } = useCustomerMessages(customer.id);
  const [channel, setChannel] = useState<'email' | 'sms' | 'internal_note'>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [aiContext, setAiContext] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);

  const handleAiDraft = async () => {
    if (!aiContext.trim()) return;
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-draft-message', {
        body: {
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          company: customer.company,
          context: aiContext,
          channel,
          totalRevenue: customer.total_revenue,
          totalOrders: customer.total_orders,
          lastOrderDate: customer.last_order_date,
        },
      });
      if (error) throw error;
      if (data?.body) setBody(data.body);
      if (data?.subject && channel === 'email') setSubject(data.subject);
      setShowAiInput(false);
      toast.success('Draft ready — review and edit before sending');
    } catch (err: any) {
      toast.error(err.message || 'AI drafting failed');
    } finally {
      setDrafting(false);
    }
  };

  const applyTemplate = (templateId: string) => {
    const t = templates.find(tpl => tpl.id === templateId);
    if (!t) return;
    let processedBody = t.body
      .replace(/\{\{customer_name\}\}/g, customer.name || 'Customer')
      .replace(/\{\{order_number\}\}/g, '');
    setBody(processedBody);
    if (t.subject) {
      setSubject(t.subject.replace(/\{\{customer_name\}\}/g, customer.name || 'Customer').replace(/\{\{order_number\}\}/g, ''));
    }
    // Auto-set channel from template
    if (t.channel === 'sms') setChannel('sms');
    else if (t.channel === 'email') setChannel('email');
  };

  const handleSend = async () => {
    if (!body.trim() || !user) return;
    setSending(true);
    try {
      if (channel === 'internal_note') {
        await addNote.mutateAsync({
          customer_id: customer.id,
          job_id: jobId,
          body,
          sent_by: user.id,
        });
      } else {
        const recipient = channel === 'email' ? customer.email : customer.phone;
        await sendMessage.mutateAsync({
          customer_id: customer.id,
          job_id: jobId,
          channel,
          subject: channel === 'email' ? subject : undefined,
          body,
          recipient: recipient || undefined,
          sent_by: user.id,
        });
      }
      setBody('');
      setSubject('');
      onOpenChange(false);
    } catch {
      // Error handled in hook
    } finally {
      setSending(false);
    }
  };

  const channelIcon = channel === 'email' ? Mail : channel === 'sms' ? MessageSquare : StickyNote;
  const ChannelIcon = channelIcon;

  const relevantTemplates = templates.filter(t => 
    t.channel === channel || t.channel === 'both' || channel === 'internal_note'
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChannelIcon className="h-5 w-5" />
            Send to {customer.name}
          </DialogTitle>
          <DialogDescription>
            {channel === 'email' && (customer.email || 'No email on file')}
            {channel === 'sms' && (customer.phone || 'No phone on file')}
            {channel === 'internal_note' && 'Internal note — not sent to customer'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Channel selector */}
          <div className="flex gap-2">
            <Button variant={channel === 'email' ? 'default' : 'outline'} size="sm" onClick={() => setChannel('email')}>
              <Mail className="h-4 w-4 mr-1" /> Email
            </Button>
            <Button variant={channel === 'sms' ? 'default' : 'outline'} size="sm" onClick={() => setChannel('sms')}>
              <MessageSquare className="h-4 w-4 mr-1" /> SMS
            </Button>
            <Button variant={channel === 'internal_note' ? 'default' : 'outline'} size="sm" onClick={() => setChannel('internal_note')}>
              <StickyNote className="h-4 w-4 mr-1" /> Note
            </Button>
          </div>

          {/* Template picker */}
          {relevantTemplates.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Use template</Label>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {relevantTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        {t.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject (email only) */}
          {channel === 'email' && (
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject..." />
            </div>
          )}

          {/* Body */}
          <div>
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={channel === 'internal_note' ? 'Add a note about this customer...' : 'Type your message...'}
              rows={6}
            />
          </div>

          {/* Warnings */}
          {channel === 'email' && !customer.email && (
            <p className="text-sm text-destructive">No email address on file for this customer.</p>
          )}
          {channel === 'sms' && !customer.phone && (
            <p className="text-sm text-destructive">No phone number on file for this customer.</p>
          )}

          <Button
            onClick={handleSend}
            disabled={sending || !body.trim() || (channel === 'email' && !customer.email) || (channel === 'sms' && !customer.phone)}
            className="w-full"
          >
            {sending ? 'Sending...' : channel === 'internal_note' ? 'Save Note' : 'Send Message'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
