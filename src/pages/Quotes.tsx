import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuotes, useQuoteStats, QUOTE_STATUS_CONFIG, type Quote } from '@/hooks/useQuotes';
import { QuoteFollowUp } from '@/components/integrations/QuoteFollowUp';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FileText, Search, DollarSign, TrendingUp, Clock, CheckCircle, Send, AlertTriangle, ExternalLink, Trash2, Mail, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { SERVICE_LABELS } from '@/lib/constants';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function Quotes() {
  const { data: quotes, isLoading } = useQuotes();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const stats = useQuoteStats(quotes);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sendingQuoteId, setSendingQuoteId] = useState<string | null>(null);

  const sendQuoteEmail = async (quoteId: string, quoteNumber: string | null, customerEmail: string | null) => {
    if (!customerEmail) {
      toast.error('No email address on this quote');
      return;
    }
    if (!confirm(`Send quote ${quoteNumber || quoteId.slice(0, 8)} to ${customerEmail}?`)) return;
    setSendingQuoteId(quoteId);
    try {
      const { data, error } = await supabase.functions.invoke('send-quote-email', {
        body: { quoteId },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || 'Failed to send');
      } else {
        toast.success(`Quote sent to ${customerEmail}`);
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send');
    } finally {
      setSendingQuoteId(null);
    }
  };

  const toggleFollowUp = async (quoteId: string, enabled: boolean) => {
    const { error } = await supabase
      .from('quotes')
      .update({ follow_up_enabled: enabled } as any)
      .eq('id', quoteId);
    if (error) {
      toast.error('Failed to update follow-up setting');
    } else {
      toast.success(enabled ? 'Follow-up enabled' : 'Follow-up disabled');
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    }
  };

  const deleteQuote = async (quoteId: string, quoteNumber: string | null) => {
    if (!confirm(`Delete quote ${quoteNumber || quoteId.slice(0, 8)}? This cannot be undone.`)) return;
    // Delete line items first, then quote
    await supabase.from('quote_line_items').delete().eq('quote_id', quoteId);
    const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
    if (error) {
      toast.error('Failed to delete quote — you may not have permission');
    } else {
      toast.success('Quote deleted');
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    }
  };

  const filtered = useMemo(() => {
    if (!quotes) return [];
    return quotes.filter(q => {
      const matchesSearch = !search ||
        q.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        q.quote_number?.toLowerCase().includes(search.toLowerCase()) ||
        q.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
        q.company?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'converted' ? q.converted_job_id !== null : q.status === statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [quotes, search, statusFilter]);

  const getDisplayStatus = (q: typeof filtered[0]) => {
    if (q.converted_job_id) return 'converted';
    return q.status;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Quotes
          </h1>
          <p className="text-muted-foreground">Track, manage, and follow up on all quotes</p>
        </div>
        <Button onClick={() => navigate('/quotes/new')}>
          <Plus className="h-4 w-4" /> New Quote
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        <StatCard icon={FileText} label="Total" value={stats.total} />
        <StatCard icon={Clock} label="Draft" value={stats.draft} />
        <StatCard icon={Send} label="Sent" value={stats.sent} />
        <StatCard icon={CheckCircle} label="Converted" value={stats.converted} className="text-green-600" />
        <StatCard icon={TrendingUp} label="Conv. Rate" value={`${stats.conversionRate}%`} />
        <StatCard icon={DollarSign} label="Total Value" value={`$${stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`} />
      </div>

      {/* Follow-Up Controls */}
      <QuoteFollowUp />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, quote #, company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">Loading quotes...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-1">
              <FileText className="h-8 w-8 opacity-50" />
              <span>No quotes found</span>
            </div>
          ) : (
            <div className="overflow-auto">
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>What They Want</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Printavo</TableHead>
                    <TableHead>Follow-Up</TableHead>
                    <TableHead className="text-center">Auto F/U</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(q => {
                    const status = getDisplayStatus(q);
                    const config = QUOTE_STATUS_CONFIG[status] || QUOTE_STATUS_CONFIG.draft;
                    return (
                      <TableRow key={q.id} className="cursor-pointer" onClick={() => navigate(`/quotes/${q.id}`)}>
                        <TableCell className="font-medium">{q.quote_number || q.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{q.customer_name}</div>
                            {q.company && <div className="text-xs text-muted-foreground">{q.company}</div>}
                            {q.customer_email && <div className="text-xs text-muted-foreground">{q.customer_email}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <QuoteDetails quote={q} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn('text-xs', config.color)}>
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {q.total_price ? `$${q.total_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(q.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          {q.printavo_visual_id ? (
                            <a
                              href={`https://www.printavo.com/invoices/${q.printavo_visual_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              #{q.printavo_visual_id}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {q.follow_up_sent_at ? (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle className="h-3.5 w-3.5" />
                              <span>
                                {q.follow_up_count >= 3 ? 'Final' : `${q.follow_up_count}/3`}
                                {' · '}
                                {format(new Date(q.follow_up_sent_at), 'MMM d')}
                              </span>
                            </div>
                          ) : (status === 'draft' || status === 'sent') && !q.converted_job_id ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Pending
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                          {!q.converted_job_id && q.status !== 'paid' && q.status !== 'approved' ? (
                            <Switch
                              checked={(q as any).follow_up_enabled ?? false}
                              onCheckedChange={(checked) => toggleFollowUp(q.id, checked)}
                              className="data-[state=checked]:bg-primary"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {q.customer_email && !q.converted_job_id && q.status !== 'approved' && q.status !== 'paid' && (
                              <button
                                onClick={() => sendQuoteEmail(q.id, q.quote_number, q.customer_email)}
                                className="text-primary hover:text-primary/80 transition-colors"
                                title="Send quote email"
                                disabled={sendingQuoteId === q.id}
                              >
                                {sendingQuoteId === q.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Mail className="h-4 w-4" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => deleteQuote(q.id, q.quote_number)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete quote"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, className }: { icon: any; label: string; value: string | number; className?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={cn('h-5 w-5 text-muted-foreground shrink-0', className)} />
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

const SERVICE_TYPE_FRIENDLY: Record<string, string> = {
  leather_patch: 'Custom Hats',
  custom_hats: 'Custom Hats',
  embroidery: 'Embroidery',
  screen_print: 'Screen Print',
  dtf: 'DTF',
  other: 'Custom Apparel',
  ...Object.fromEntries(Object.entries(SERVICE_LABELS)),
};

function QuoteDetails({ quote }: { quote: Quote }) {
  const items = quote.quote_line_items || [];
  if (items.length === 0 && !quote.notes) {
    return <span className="text-xs text-muted-foreground">No details</span>;
  }

  // Summarize services
  const services = [...new Set(items.map(i => SERVICE_TYPE_FRIENDLY[i.service_type] || i.service_type))];
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  // Collect descriptions
  const descriptions = items
    .map(i => [i.description, i.style_number, i.color].filter(Boolean).join(' · '))
    .filter(Boolean);

  return (
    <div className="max-w-[280px] space-y-0.5">
      {services.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {services.map(s => (
            <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0">
              {s}
            </Badge>
          ))}
          {totalQty > 0 && (
            <span className="text-[10px] text-muted-foreground ml-1">({totalQty} pcs)</span>
          )}
        </div>
      )}
      {descriptions.slice(0, 2).map((d, i) => (
        <div key={i} className="text-xs text-muted-foreground truncate">{d}</div>
      ))}
      {descriptions.length > 2 && (
        <div className="text-[10px] text-muted-foreground">+{descriptions.length - 2} more items</div>
      )}
      {!items.length && quote.notes && (
        <div className="text-xs text-muted-foreground truncate">{quote.notes}</div>
      )}
    </div>
  );
}
