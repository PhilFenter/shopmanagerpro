import { useState, useEffect } from 'react';
import { useQuotes } from '@/hooks/useQuotes';
import { useCustomers } from '@/hooks/useCustomers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  User, Building2, MapPin, Mail, Phone, FileText,
  Truck, Calendar, CreditCard, Search, Loader2,
} from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAYMENT_TERMS = [
  { value: 'due_on_receipt', label: 'Due on Receipt' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: '50_50', label: '50% Deposit / 50% on Delivery' },
  { value: 'prepaid', label: 'Prepaid' },
];

const DELIVERY_METHODS = [
  { value: 'pickup', label: 'Customer Pickup' },
  { value: 'delivery', label: 'Local Delivery' },
  { value: 'ship', label: 'Ship' },
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

export function NewQuoteDialog({ open, onOpenChange }: Props) {
  const { createQuote } = useQuotes();
  const { customers } = useCustomers();
  const [tab, setTab] = useState<'manual' | 'email'>('manual');

  // Customer fields
  const [customerSearch, setCustomerSearch] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('ID');
  const [zip, setZip] = useState('');

  // Business fields
  const [isNonprofit, setIsNonprofit] = useState(false);
  const [applySalesTax, setApplySalesTax] = useState(true);
  const [taxRate, setTaxRate] = useState(6.0);
  const [deliveryMethod, setDeliveryMethod] = useState('pickup');
  const [shippingAddress, setShippingAddress] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('due_on_receipt');
  const [notes, setNotes] = useState('');
  const [rawEmail, setRawEmail] = useState('');

  // Customer lookup
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const filteredCustomers = customerSearch.length >= 2
    ? customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.email?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.company?.toLowerCase().includes(customerSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  // Auto-toggle tax when nonprofit changes
  useEffect(() => {
    if (isNonprofit) setApplySalesTax(false);
  }, [isNonprofit]);

  const selectExistingCustomer = (customer: any) => {
    setSelectedCustomerId(customer.id);
    setName(customer.name);
    setCompany(customer.company || '');
    setEmail(customer.email || '');
    setPhone(customer.phone || '');
    setAddressLine1(customer.address_line1 || '');
    setAddressLine2(customer.address_line2 || '');
    setCity(customer.city || '');
    setState(customer.state || 'ID');
    setZip(customer.zip || '');
    setCustomerSearch('');
    setShowCustomerDropdown(false);
  };

  const resetForm = () => {
    setTab('manual');
    setCustomerSearch('');
    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setAddressLine1('');
    setAddressLine2('');
    setCity('');
    setState('ID');
    setZip('');
    setIsNonprofit(false);
    setApplySalesTax(true);
    setTaxRate(6.0);
    setDeliveryMethod('pickup');
    setShippingAddress('');
    setRequestedDate('');
    setPoNumber('');
    setPaymentTerms('due_on_receipt');
    setNotes('');
    setRawEmail('');
    setSelectedCustomerId(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;

    await createQuote.mutateAsync({
      customer_name: name.trim(),
      customer_email: email.trim() || undefined,
      customer_phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      raw_email: rawEmail.trim() || undefined,
      company: company.trim() || undefined,
      address_line1: addressLine1.trim() || undefined,
      address_line2: addressLine2.trim() || undefined,
      city: city.trim() || undefined,
      state: state || undefined,
      zip: zip.trim() || undefined,
      is_nonprofit: isNonprofit,
      apply_sales_tax: applySalesTax,
      tax_rate: taxRate,
      delivery_method: deliveryMethod,
      shipping_address: deliveryMethod === 'ship' ? shippingAddress.trim() || undefined : undefined,
      requested_date: requestedDate || undefined,
      po_number: poNumber.trim() || undefined,
      payment_terms: paymentTerms,
      customer_id: selectedCustomerId || undefined,
    } as any);

    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Quote</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'manual' | 'email')}>
          <TabsList className="w-full">
            <TabsTrigger value="manual" className="flex-1">Manual Entry</TabsTrigger>
            <TabsTrigger value="email" className="flex-1">Paste Email</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-5 mt-4">
            {/* Customer Lookup */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4" />
                Customer Information
              </div>

              {/* Search existing customers */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search existing customers..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="pl-9"
                />
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-auto">
                    {filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                        onClick={() => selectExistingCustomer(c)}
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.company && <span className="text-muted-foreground ml-2">{c.company}</span>}
                        {c.email && <span className="text-muted-foreground ml-2">— {c.email}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedCustomerId && (
                <Badge variant="secondary" className="text-xs">
                  Linked to existing customer record
                </Badge>
              )}

              {/* Name & Company */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="q-name">Contact Name *</Label>
                  <Input id="q-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith" />
                </div>
                <div>
                  <Label htmlFor="q-company">
                    <Building2 className="inline h-3.5 w-3.5 mr-1" />
                    Company / Organization
                  </Label>
                  <Input id="q-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="q-email">
                    <Mail className="inline h-3.5 w-3.5 mr-1" />
                    Email
                  </Label>
                  <Input id="q-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="q-phone">
                    <Phone className="inline h-3.5 w-3.5 mr-1" />
                    Phone
                  </Label>
                  <Input id="q-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label>
                  <MapPin className="inline h-3.5 w-3.5 mr-1" />
                  Address
                </Label>
                <Input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Street address" />
                <Input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Apt, suite, unit (optional)" />
                <div className="grid grid-cols-3 gap-2">
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="ZIP" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Tax & Business Settings */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CreditCard className="h-4 w-4" />
                Tax & Billing
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Nonprofit / Tax Exempt</p>
                    <p className="text-xs text-muted-foreground">Tax will be disabled</p>
                  </div>
                  <Switch checked={isNonprofit} onCheckedChange={setIsNonprofit} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Apply Sales Tax</p>
                    <p className="text-xs text-muted-foreground">Idaho {taxRate}%</p>
                  </div>
                  <Switch checked={applySalesTax} onCheckedChange={setApplySalesTax} disabled={isNonprofit} />
                </div>
              </div>

              {applySalesTax && (
                <div className="w-32">
                  <Label>Tax Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    max={20}
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Payment Terms</Label>
                  <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="q-po">PO Number</Label>
                  <Input id="q-po" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Optional" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Delivery & Schedule */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Truck className="h-4 w-4" />
                Delivery & Schedule
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Delivery Method</Label>
                  <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_METHODS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="q-date">
                    <Calendar className="inline h-3.5 w-3.5 mr-1" />
                    Requested Date
                  </Label>
                  <Input
                    id="q-date"
                    type="date"
                    value={requestedDate}
                    onChange={(e) => setRequestedDate(e.target.value)}
                  />
                </div>
              </div>

              {deliveryMethod === 'ship' && (
                <div>
                  <Label>Shipping Address</Label>
                  <Textarea
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="Ship-to address (if different from billing)"
                    rows={2}
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Notes */}
            <div>
              <Label htmlFor="q-notes">
                <FileText className="inline h-3.5 w-3.5 mr-1" />
                Notes
              </Label>
              <Textarea id="q-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </TabsContent>

          <TabsContent value="email" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="q-name-email">Customer Name *</Label>
              <Input id="q-name-email" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Palouse Coffee Co." />
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

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || createQuote.isPending}>
            {createQuote.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
            ) : (
              'Create Quote'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
