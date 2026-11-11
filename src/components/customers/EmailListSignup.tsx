import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MailCheck, MailPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  customerId: string;
  email: string | null;
  consented: boolean;
  consentedAt: string | null;
  consentSource: string | null;
}

/**
 * Counter signup: staff add a customer to the HCD Email List only after the
 * customer says yes out loud. Ordering, quoting or having an email on file is
 * not a yes.
 */
export function EmailListSignup({ customerId, email, consented, consentedAt, consentSource }: Props) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const isOn = consented || done;

  const signUp = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('klaviyo-subscribe', {
      body: { customer_id: customerId },
    });
    setSaving(false);
    setConfirmOpen(false);
    if (error || !data?.ok) {
      let message = 'Could not add to the email list.';
      try {
        const body = await (error as { context?: Response })?.context?.json?.();
        if (body?.error) message = body.error;
      } catch { /* keep default */ }
      toast.error(message);
      return;
    }
    setDone(true);
    toast.success(`${email} is on the HCD Email List.`);
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  };

  if (isOn) {
    const when = consentedAt ? new Date(consentedAt).toLocaleDateString() : 'today';
    const where = consentSource === 'website' ? 'website form' : 'counter';
    return (
      <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
        <MailCheck className="h-4 w-4 text-green-600" />
        <span>On the HCD Email List · said yes {done ? 'today' : when} ({done ? 'counter' : where})</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div className="text-sm">
          <p className="font-medium">Email list</p>
          <p className="text-xs text-muted-foreground">
            {email ? 'Ask first: "Want our deals and order deadlines by email?"' : 'Add an email address and save to enable signup.'}
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={!email || saving} onClick={() => setConfirmOpen(true)}>
          <MailPlus className="h-4 w-4 mr-1.5" /> Add to email list
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Did the customer say yes?</AlertDialogTitle>
            <AlertDialogDescription>
              Only add {email} if they agreed to get HCD marketing emails. They can unsubscribe any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={(e) => { e.preventDefault(); void signUp(); }}>
              {saving ? 'Adding…' : 'Yes, they agreed'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
