import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useToast } from './use-toast';

export type Customer = Tables<'customers'>;

export function useCustomers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('total_revenue', { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Customer> & { id: string }) => {
      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Customer updated' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to update customer', description: error.message });
    },
  });

  const totalRevenue = customers.reduce((sum, c) => sum + (c.total_revenue || 0), 0);
  const totalCustomers = customers.length;

  // Pareto analysis
  const sortedByRevenue = [...customers].sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0));
  let cumulativeRevenue = 0;
  let paretoCustomerCount = 0;
  for (const c of sortedByRevenue) {
    cumulativeRevenue += c.total_revenue || 0;
    paretoCustomerCount++;
    if (cumulativeRevenue >= totalRevenue * 0.8) break;
  }
  const paretoPercent = totalCustomers > 0 ? ((paretoCustomerCount / totalCustomers) * 100).toFixed(1) : '0';

  // Category breakdown
  const categoryMap = new Map<string, { count: number; revenue: number }>();
  for (const c of customers) {
    const tags = c.tags || [];
    const category = tags.length > 0 ? tags[0] : 'Uncategorized';
    const existing = categoryMap.get(category) || { count: 0, revenue: 0 };
    categoryMap.set(category, {
      count: existing.count + 1,
      revenue: existing.revenue + (c.total_revenue || 0),
    });
  }
  const categories = Array.from(categoryMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  // Pareto curve data
  const paretoCurve = sortedByRevenue.map((c, i) => ({
    customerPercent: ((i + 1) / totalCustomers) * 100,
    revenuePercent: sortedByRevenue.slice(0, i + 1).reduce((s, x) => s + (x.total_revenue || 0), 0) / totalRevenue * 100,
    name: c.name,
    revenue: c.total_revenue || 0,
  }));

  return {
    customers,
    isLoading,
    totalRevenue,
    totalCustomers,
    paretoCustomerCount,
    paretoPercent,
    categories,
    paretoCurve,
    topCustomers: sortedByRevenue.slice(0, 20),
    updateCustomer,
  };
}
