import { useState } from 'react';
import { useQuotes } from '@/hooks/useQuotes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewQuoteDialog({ open, onOpenChange }: Props) {
  const { createQuote } = useQuotes();
  const [tab, setTab] = useState<'manual' | 'email'>('manual');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [rawEmail, setRawEmail] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;

    await createQuote.mutateAsync({
      customer_name: name.trim(),
      customer_email: email.trim() || undefined,
      customer_phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      raw_email: rawEmail.trim() || undefined,
    });

    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setRawEmail('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Quote</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'manual' | 'email')}>
          <TabsList className="w-full">
            <TabsTrigger value="manual" className="flex-1">Manual Entry</TabsTrigger>
            <TabsTrigger value="email" className="flex-1">Paste Email</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="customer-name">Customer Name *</Label>
              <Input
                id="customer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Palouse Coffee Co."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customer-email">Email</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="customer-phone">Phone</Label>
                <Input
                  id="customer-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="quote-notes">Notes</Label>
              <Textarea
                id="quote-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="email" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="customer-name-email">Customer Name *</Label>
              <Input
                id="customer-name-email"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Palouse Coffee Co."
              />
            </div>
            <div>
              <Label htmlFor="raw-email">Paste Customer Email</Label>
              <Textarea
                id="raw-email"
                value={rawEmail}
                onChange={(e) => setRawEmail(e.target.value)}
                rows={8}
                placeholder="Paste the customer's email here. You can use AI to parse it into line items after creating the quote..."
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || createQuote.isPending}>
            {createQuote.isPending ? 'Creating...' : 'Create Quote'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
