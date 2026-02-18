import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageThread } from './MessageThread';
import { SendMessageDialog } from './SendMessageDialog';
import { useCustomerMessages } from '@/hooks/useCustomerMessages';
import { useState } from 'react';
import { Mail, Phone, Building, DollarSign, ShoppingBag, Send } from 'lucide-react';
import type { Customer } from '@/hooks/useCustomers';

interface CustomerDetailSheetProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerDetailSheet({ customer, open, onOpenChange }: CustomerDetailSheetProps) {
  const { messages, isLoading } = useCustomerMessages(customer?.id);
  const [sendOpen, setSendOpen] = useState(false);

  if (!customer) return null;

  const formatCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{customer.name}</SheetTitle>
            <SheetDescription>{customer.company || 'Individual'}</SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Contact info */}
            <div className="flex flex-wrap gap-3 text-sm">
              {customer.email && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> {customer.email}
                </span>
              )}
              {customer.phone && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> {customer.phone}
                </span>
              )}
            </div>

            {/* Stats */}
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

            {/* Tags */}
            {customer.tags && customer.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {customer.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
              </div>
            )}

            {/* Actions */}
            <Button onClick={() => setSendOpen(true)} className="w-full">
              <Send className="h-4 w-4 mr-2" /> Send Message
            </Button>

            {/* Communication Timeline */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Communication History</h3>
              <MessageThread messages={messages} isLoading={isLoading} />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <SendMessageDialog open={sendOpen} onOpenChange={setSendOpen} customer={customer} />
    </>
  );
}
