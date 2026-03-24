import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function AddCustomerDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    notes: '',
  });

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('customers').insert({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        notes: form.notes.trim() || null,
        source: 'manual',
      });
      if (error) throw error;
      toast.success('Customer added');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setForm({ name: '', email: '', phone: '', company: '', notes: '' });
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="cust-name">Name *</Label>
            <Input id="cust-name" value={form.name} onChange={e => update('name', e.target.value)} placeholder="John Smith" />
          </div>
          <div>
            <Label htmlFor="cust-email">Email</Label>
            <Input id="cust-email" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="john@example.com" />
          </div>
          <div>
            <Label htmlFor="cust-phone">Phone</Label>
            <Input id="cust-phone" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="(208) 555-1234" />
          </div>
          <div>
            <Label htmlFor="cust-company">Company</Label>
            <Input id="cust-company" value={form.company} onChange={e => update('company', e.target.value)} placeholder="Acme Corp" />
          </div>
          <div>
            <Label htmlFor="cust-notes">Notes</Label>
            <Textarea id="cust-notes" value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Any notes..." rows={3} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Add Customer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
