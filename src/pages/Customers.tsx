import { useCustomers } from '@/hooks/useCustomers';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { hasFinancialAccess } from '@/hooks/useJobs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, Cell, PieChart, Pie,
} from 'recharts';
import { Users, DollarSign, TrendingUp, Search, Crown, Download, RefreshCw, CalendarIcon, Filter } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CustomerDetailSheet } from '@/components/communications/CustomerDetailSheet';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { Customer } from '@/hooks/useCustomers';

const COLORS = [
  'hsl(200, 98%, 39%)', 'hsl(213, 93%, 67%)', 'hsl(36, 90%, 50%)',
  'hsl(160, 60%, 45%)', 'hsl(280, 60%, 55%)', 'hsl(0, 72%, 50%)',
  'hsl(45, 80%, 50%)', 'hsl(190, 70%, 50%)', 'hsl(330, 60%, 50%)',
  'hsl(120, 50%, 45%)',
];

export default function Customers() {
  const { role, loading } = useAuth();
  const { customers, isLoading, totalRevenue, totalCustomers, paretoCustomerCount, paretoPercent, categories, paretoCurve, topCustomers } = useCustomers();
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);
  const [lastOrderFrom, setLastOrderFrom] = useState<Date | undefined>();
  const [lastOrderTo, setLastOrderTo] = useState<Date | undefined>();
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const formatCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const filteredCustomers = useMemo(() => {
    let result = customers;
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.company?.toLowerCase().includes(s) ||
        c.tags?.some(t => t.toLowerCase().includes(s))
      );
    }
    if (sourceFilters.length > 0) {
      result = result.filter(c => sourceFilters.includes(c.source || 'manual'));
    }
    if (lastOrderFrom) {
      result = result.filter(c => c.last_order_date && new Date(c.last_order_date) >= lastOrderFrom);
    }
    if (lastOrderTo) {
      result = result.filter(c => c.last_order_date && new Date(c.last_order_date) <= lastOrderTo);
    }
    return result;
  }, [customers, search, sourceFilter, lastOrderFrom, lastOrderTo]);

  const uniqueSources = useMemo(() => {
    const sources = new Set(customers.map(c => c.source || 'manual'));
    return Array.from(sources).sort();
  }, [customers]);

  const avgLTV = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  const topCategories = categories.slice(0, 10);

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;
  if (!hasFinancialAccess(role)) return <Navigate to="/dashboard" replace />;

  if (isLoading) return <div className="flex items-center justify-center h-64">Loading CRM data...</div>;

  const handleSyncContacts = async () => {
    setIsSyncingContacts(true);
    try {
      const { data, error } = await supabase.functions.invoke('printavo-customer-sync', {
        body: { maxPages: 200 },
      });
      if (error) throw error;
      toast({
        title: 'Customer sync complete',
        description: `${data.inserted} new, ${data.updated} updated, ${data.skipped} unchanged (${data.total} total from Printavo)`,
      });
      // Refetch customers without hard reload
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Sync failed', description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsSyncingContacts(false);
    }
  };

  const handleExportCSV = () => {
    const emailCustomers = filteredCustomers.filter(c => c.email);
    if (emailCustomers.length === 0) {
      toast({ variant: 'destructive', title: 'No emails to export', description: 'No customers with email addresses found.' });
      return;
    }
    const headers = ['email', 'first_name', 'last_name', 'phone', 'company', 'last_order_date', 'total_orders', 'total_revenue', 'source'];
    const rows = emailCustomers.map(c => {
      const nameParts = (c.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      return [
        c.email || '',
        `"${firstName.replace(/"/g, '""')}"`,
        `"${lastName.replace(/"/g, '""')}"`,
        c.phone || '',
        `"${(c.company || '').replace(/"/g, '""')}"`,
        c.last_order_date ? c.last_order_date.split('T')[0] : '',
        c.total_orders?.toString() || '0',
        c.total_revenue?.toString() || '0',
        c.source || 'manual',
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `klaviyo-customers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${emailCustomers.length} customers for Klaviyo` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Customer lifetime value, Pareto analysis, and segmentation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSyncContacts} disabled={isSyncingContacts}>
            {isSyncingContacts ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {isSyncingContacts ? 'Syncing...' : 'Pull Printavo Contacts'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export for Klaviyo
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filters
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Last Order From</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal", !lastOrderFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {lastOrderFrom ? format(lastOrderFrom, "MM/dd/yyyy") : "Any"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={lastOrderFrom} onSelect={setLastOrderFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Last Order To</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal", !lastOrderTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {lastOrderTo ? format(lastOrderTo, "MM/dd/yyyy") : "Any"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={lastOrderTo} onSelect={setLastOrderTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Source</label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {uniqueSources.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(lastOrderFrom || lastOrderTo || sourceFilter !== 'all') && (
              <Button variant="ghost" size="sm" onClick={() => { setLastOrderFrom(undefined); setLastOrderTo(undefined); setSourceFilter('all'); }}>
                Clear filters
              </Button>
            )}
            <div className="ml-auto text-sm text-muted-foreground">
              {filteredCustomers.filter(c => c.email).length} exportable (with email)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Across all sources</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Lifetime tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average LTV</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(avgLTV)}</div>
            <p className="text-xs text-muted-foreground">Per customer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">80/20 Rule</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paretoPercent}%</div>
            <p className="text-xs text-muted-foreground">{paretoCustomerCount} customers drive 80% of revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Pareto Curve */}
      <Card>
        <CardHeader>
          <CardTitle>Pareto Analysis (80/20)</CardTitle>
          <CardDescription>
            {paretoCustomerCount} customers ({paretoPercent}%) generate 80% of your {formatCurrency(totalRevenue)} in total revenue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={paretoCurve.filter((_, i) => i % Math.max(1, Math.floor(paretoCurve.length / 100)) === 0 || i === paretoCurve.length - 1)}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="customerPercent" tickFormatter={v => `${Math.round(v)}%`} label={{ value: '% of Customers', position: 'bottom', offset: -5 }} className="text-xs fill-muted-foreground" />
                <YAxis tickFormatter={v => `${Math.round(v)}%`} label={{ value: '% of Revenue', angle: -90, position: 'insideLeft' }} className="text-xs fill-muted-foreground" />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Revenue']} labelFormatter={v => `Top ${Number(v).toFixed(0)}% of customers`} />
                <Area type="monotone" dataKey="revenuePercent" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown + Top Customers */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Category</CardTitle>
            <CardDescription>Industry segmentation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={topCategories} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name.length > 15 ? name.slice(0, 15) + '…' : name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {topCategories.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 20 Customers</CardTitle>
            <CardDescription>By lifetime revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCustomers} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} className="text-xs fill-muted-foreground" />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total_revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <CardTitle>All Customers</CardTitle>
              <CardDescription>{filteredCustomers.length} customers</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, email, category..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.slice(0, 100).map(c => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedCustomer(c)}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{c.name}</p>
                        {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.tags?.map(t => (
                        <Badge key={t} variant="secondary" className="mr-1 text-xs">{t}</Badge>
                      ))}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(c.total_revenue || 0)}</TableCell>
                    <TableCell className="text-right">{c.total_orders || 0}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{c.source || 'manual'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredCustomers.length > 100 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                Showing 100 of {filteredCustomers.length} customers. Use search to filter.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <CustomerDetailSheet
        customer={selectedCustomer}
        open={!!selectedCustomer}
        onOpenChange={(open) => !open && setSelectedCustomer(null)}
      />
    </div>
  );
}
