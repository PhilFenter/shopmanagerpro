import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useToast } from './use-toast';

export type Customer = Tables<'customers'>;

export const CUSTOMERS_PAGE_SIZE = 50;

export interface CustomerFilters {
  search?: string;
  sources?: string[];
  lastOrderFrom?: Date;
  lastOrderTo?: Date;
  revenueMin?: number;
  revenueMax?: number;
}

export interface CustomerAnalytics {
  total_customers: number;
  total_revenue: number;
  avg_ltv: number;
  pareto_customer_count: number;
  pareto_percent: number;
  categories: { name: string; count: number; revenue: number }[];
  top_customers: Pick<Customer, 'id' | 'name' | 'company' | 'email' | 'total_revenue' | 'total_orders' | 'last_order_date'>[];
  pareto_curve: { customerPercent: number; revenuePercent: number; name: string; revenue: number }[];
  sources: string[];
}

/**
 * Applies the page's filters to a PostgREST query.
 *
 * Filtering happens in Postgres rather than the browser because a plain
 * `select('*')` is capped at 1000 rows — with more customers than that, the
 * newest ones (which sort last by revenue) were never fetched and so could
 * never be found by the search box.
 */
function applyFilters<T extends ReturnType<typeof supabase.from>['select']>(
  query: any,
  filters: CustomerFilters,
) {
  const search = filters.search?.trim();
  if (search) {
    // search_text is a generated column (name + email + company + first tag)
    // backed by a trigram index, so this stays fast as the table grows.
    query = query.ilike('search_text', `%${search}%`);
  }
  if (filters.sources?.length) {
    query = query.in('source', filters.sources);
  }
  if (filters.lastOrderFrom) {
    query = query.gte('last_order_date', filters.lastOrderFrom.toISOString());
  }
  if (filters.lastOrderTo) {
    query = query.lte('last_order_date', filters.lastOrderTo.toISOString());
  }
  if (filters.revenueMin !== undefined && !Number.isNaN(filters.revenueMin)) {
    query = query.gte('total_revenue', filters.revenueMin);
  }
  if (filters.revenueMax !== undefined && !Number.isNaN(filters.revenueMax)) {
    query = query.lte('total_revenue', filters.revenueMax);
  }
  return query;
}

/** One page of customers matching the given filters, plus the total match count. */
export function useCustomers(filters: CustomerFilters = {}, page = 0) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['customers', filters, page],
    queryFn: async () => {
      const from = page * CUSTOMERS_PAGE_SIZE;
      const to = from + CUSTOMERS_PAGE_SIZE - 1;

      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order('total_revenue', { ascending: false, nullsFirst: false })
        .order('id')
        .range(from, to);

      query = applyFilters(query, filters);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as Customer[], total: count ?? 0 };
    },
    // Keeps the previous page on screen while the next one loads, instead of
    // flashing an empty table on every keystroke.
    placeholderData: keepPreviousData,
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
      queryClient.invalidateQueries({ queryKey: ['customer-analytics'] });
      toast({ title: 'Customer updated' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Failed to update customer', description: error.message });
    },
  });

  const total = data?.total ?? 0;

  return {
    customers: data?.rows ?? [],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / CUSTOMERS_PAGE_SIZE)),
    isLoading,
    isFetching,
    error,
    updateCustomer,
  };
}

/**
 * Aggregates over *every* customer, computed in Postgres.
 *
 * These cannot be derived from a page of rows, and deriving them from the old
 * truncated fetch is what made total revenue, average LTV, the Pareto split and
 * the category breakdown quietly wrong once the table passed 1000 rows.
 */
export function useCustomerAnalytics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('customer_analytics');
      if (error) throw error;
      return data as unknown as CustomerAnalytics;
    },
    staleTime: 5 * 60 * 1000,
  });

  return { analytics: data, isLoading, error };
}

/**
 * Every customer matching the filters, for CSV export — fetched in pages so it
 * is not subject to the 1000-row cap. Called on demand, never on render.
 */
export async function fetchAllMatchingCustomers(filters: CustomerFilters): Promise<Customer[]> {
  const PAGE = 1000;
  const all: Customer[] = [];

  for (let page = 0; ; page++) {
    let query = supabase
      .from('customers')
      .select('*')
      .order('total_revenue', { ascending: false, nullsFirst: false })
      .order('id')
      .range(page * PAGE, page * PAGE + PAGE - 1);

    query = applyFilters(query, filters);

    const { data, error } = await query;
    if (error) throw error;

    all.push(...((data ?? []) as Customer[]));
    if (!data || data.length < PAGE) break;
  }

  return all;
}
