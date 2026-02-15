import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function SalesTaxReport() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['sales-tax-report', selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31T23:59:59`;
      const { data, error } = await supabase
        .from('jobs')
        .select('sale_price, tax_collected, created_at, source')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const monthlyData = useMemo(() => {
    const months = MONTHS.map((name, index) => ({
      name,
      index,
      totalSales: 0,
      taxCollected: 0,
      untaxedSales: 0,
      jobCount: 0,
    }));

    for (const job of jobs) {
      const month = new Date(job.created_at).getMonth();
      const sale = job.sale_price || 0;
      const tax = job.tax_collected || 0;
      months[month].totalSales += sale;
      months[month].taxCollected += tax;
      months[month].untaxedSales += tax === 0 ? sale : 0;
      months[month].jobCount++;
    }

    return months;
  }, [jobs]);

  const yearTotals = useMemo(() => {
    return monthlyData.reduce(
      (acc, m) => ({
        totalSales: acc.totalSales + m.totalSales,
        taxCollected: acc.taxCollected + m.taxCollected,
        untaxedSales: acc.untaxedSales + m.untaxedSales,
        jobCount: acc.jobCount + m.jobCount,
      }),
      { totalSales: 0, taxCollected: 0, untaxedSales: 0, jobCount: 0 }
    );
  }, [monthlyData]);

  const fmt = (v: number) =>
    `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const years = Array.from({ length: 3 }, (_, i) => (currentYear - i).toString());

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Sales Tax Report
            </CardTitle>
            <CardDescription>Monthly breakdown for tax filing</CardDescription>
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">{fmt(yearTotals.totalSales)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Tax Collected</p>
                <p className="text-2xl font-bold text-destructive">{fmt(yearTotals.taxCollected)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Untaxed Sales</p>
                <p className="text-2xl font-bold">{fmt(yearTotals.untaxedSales)}</p>
              </div>
            </div>

            {/* Monthly Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead className="text-right">Total Sales</TableHead>
                  <TableHead className="text-right">Tax Collected</TableHead>
                  <TableHead className="text-right">Untaxed Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.map((m) => {
                  const isCurrent = parseInt(selectedYear) === currentYear && m.index === currentMonth;
                  const isFuture = parseInt(selectedYear) === currentYear && m.index > currentMonth;
                  if (isFuture && m.jobCount === 0) return null;
                  
                  return (
                    <TableRow key={m.index} className={isFuture ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">
                        {m.name}
                        {isCurrent && (
                          <Badge variant="secondary" className="ml-2 text-xs">Current</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{m.jobCount}</TableCell>
                      <TableCell className="text-right">{fmt(m.totalSales)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {m.taxCollected > 0 ? fmt(m.taxCollected) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {m.untaxedSales > 0 ? fmt(m.untaxedSales) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Totals row */}
                <TableRow className="font-bold border-t-2">
                  <TableCell>Year Total</TableCell>
                  <TableCell className="text-right">{yearTotals.jobCount}</TableCell>
                  <TableCell className="text-right">{fmt(yearTotals.totalSales)}</TableCell>
                  <TableCell className="text-right text-destructive">{fmt(yearTotals.taxCollected)}</TableCell>
                  <TableCell className="text-right">{fmt(yearTotals.untaxedSales)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}