import { useState, useMemo } from 'react';
import { useQuotes, useQuoteStats, QUOTE_STATUS_CONFIG, type Quote } from '@/hooks/useQuotes';
import { QuoteFollowUp } from '@/components/integrations/QuoteFollowUp';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Search, DollarSign, TrendingUp, Clock, CheckCircle, Send, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { SERVICE_LABELS } from '@/lib/constants';

export default function Quotes() {
  const { data: quotes, isLoading } = useQuotes();
  const stats = useQuoteStats(quotes);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Quotes
        </h1>
        <p className="text-muted-foreground">Track, manage, and follow up on all quotes</p>
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
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Follow-Up</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(q => {
                    const status = getDisplayStatus(q);
                    const config = QUOTE_STATUS_CONFIG[status] || QUOTE_STATUS_CONFIG.draft;
                    return (
                      <TableRow key={q.id}>
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
                          {q.follow_up_sent_at ? (
                            <div className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle className="h-3.5 w-3.5" />
                              Sent {format(new Date(q.follow_up_sent_at), 'MMM d')}
                            </div>
                          ) : status === 'draft' && !q.converted_job_id ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Pending
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
