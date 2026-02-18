import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageThread } from './MessageThread';
import { SendMessageDialog } from './SendMessageDialog';
import { useCustomerMessages } from '@/hooks/useCustomerMessages';
import { useCustomers } from '@/hooks/useCustomers';
import { useState, useEffect } from 'react';
import { Mail, Phone, Building, DollarSign, ShoppingBag, Send, Save, User, Globe, MapPin, Tag } from 'lucide-react';
import type { Customer } from '@/hooks/useCustomers';

interface CustomerDetailSheetProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerDetailSheet({ customer, open, onOpenChange }: CustomerDetailSheetProps) {
  const { messages, isLoading } = useCustomerMessages(customer?.id);
  const { updateCustomer } = useCustomers();
  const [sendOpen, setSendOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  // Reset form when customer changes
  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        company: customer.company || '',
        title: (customer as any).title || '',
        website: (customer as any).website || '',
        address_line1: (customer as any).address_line1 || '',
        address_line2: (customer as any).address_line2 || '',
        city: (customer as any).city || '',
        state: (customer as any).state || '',
        zip: (customer as any).zip || '',
        referral_source: (customer as any).referral_source || '',
        preferred_contact: (customer as any).preferred_contact || 'email',
        notes: customer.notes || '',
        tags: (customer.tags || []).join(', '),
      });
      setDirty(false);
    }
  }, [customer]);

  if (!customer) return null;

  const formatCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const updateField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    const tags = form.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    updateCustomer.mutate({
      id: customer.id,
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      company: form.company || null,
      title: form.title || null,
      website: form.website || null,
      address_line1: form.address_line1 || null,
      address_line2: form.address_line2 || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      referral_source: form.referral_source || null,
      preferred_contact: form.preferred_contact || 'email',
      notes: form.notes || null,
      tags,
    } as any);
    setDirty(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{customer.name}</SheetTitle>
            <SheetDescription>{customer.company || 'Individual'}{(customer as any).title ? ` · ${(customer as any).title}` : ''}</SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
            </TabsList>

            {/* DETAILS TAB */}
            <TabsContent value="details" className="space-y-5 mt-4">
              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" /> Lifetime Revenue
                  </div>
                  <p className="text-lg font-bold mt-1">{formatCurrency(customer.total_revenue || 0)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShoppingBag className="h-3.5 w-3.5" /> Total Orders
                  </div>
                  <p className="text-lg font-bold mt-1">{customer.total_orders || 0}</p>
                </div>
              </div>

              {/* Contact Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5"><User className="h-4 w-4" /> Contact Info</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input value={form.name} onChange={e => updateField('name', e.target.value)} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs text-muted-foreground">Title / Position</Label>
                    <Input value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="e.g. Owner, Purchasing Mgr" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <Input value={form.phone} onChange={e => updateField('phone', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Company Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5"><Building className="h-4 w-4" /> Company</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs text-muted-foreground">Company Name</Label>
                    <Input value={form.company} onChange={e => updateField('company', e.target.value)} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs text-muted-foreground">Website</Label>
                    <Input value={form.website} onChange={e => updateField('website', e.target.value)} placeholder="https://" />
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Address</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Address Line 1</Label>
                    <Input value={form.address_line1} onChange={e => updateField('address_line1', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Address Line 2</Label>
                    <Input value={form.address_line2} onChange={e => updateField('address_line2', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">City</Label>
                    <Input value={form.city} onChange={e => updateField('city', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">State</Label>
                      <Input value={form.state} onChange={e => updateField('state', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">ZIP</Label>
                      <Input value={form.zip} onChange={e => updateField('zip', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* CRM Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5"><Tag className="h-4 w-4" /> CRM Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Referral Source</Label>
                    <Input value={form.referral_source} onChange={e => updateField('referral_source', e.target.value)} placeholder="e.g. Word of mouth, Google" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Preferred Contact</Label>
                    <Select value={form.preferred_contact} onValueChange={v => updateField('preferred_contact', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="in_person">In Person</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Tags (comma-separated)</Label>
                    <Input value={form.tags} onChange={e => updateField('tags', e.target.value)} placeholder="e.g. VIP, Manufacturing" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <Textarea value={form.notes} onChange={e => updateField('notes', e.target.value)} rows={3} />
                  </div>
                </div>
              </div>

              {/* Date info (read-only) */}
              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                {customer.first_order_date && <p>First order: {new Date(customer.first_order_date).toLocaleDateString()}</p>}
                {customer.last_order_date && <p>Last order: {new Date(customer.last_order_date).toLocaleDateString()}</p>}
                <p>Source: {customer.source || 'manual'}</p>
              </div>

              {/* Save Button */}
              {dirty && (
                <Button onClick={handleSave} className="w-full" disabled={updateCustomer.isPending}>
                  <Save className="h-4 w-4 mr-2" /> Save Changes
                </Button>
              )}
            </TabsContent>

            {/* ACTIVITY TAB */}
            <TabsContent value="activity" className="mt-4">
              <div className="text-sm text-muted-foreground space-y-3">
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="font-medium text-foreground">Customer Since</p>
                  <p>{customer.first_order_date ? new Date(customer.first_order_date).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="font-medium text-foreground">Last Order</p>
                  <p>{customer.last_order_date ? new Date(customer.last_order_date).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="font-medium text-foreground">Average Order Value</p>
                  <p>{customer.total_orders ? formatCurrency((customer.total_revenue || 0) / customer.total_orders) : 'N/A'}</p>
                </div>
              </div>
            </TabsContent>

            {/* MESSAGES TAB */}
            <TabsContent value="messages" className="space-y-4 mt-4">
              <Button onClick={() => setSendOpen(true)} className="w-full">
                <Send className="h-4 w-4 mr-2" /> Send Message
              </Button>
              <MessageThread messages={messages} isLoading={isLoading} />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <SendMessageDialog open={sendOpen} onOpenChange={setSendOpen} customer={customer} />
    </>
  );
}
