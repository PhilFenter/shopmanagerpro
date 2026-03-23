import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface HistoricalSyncResult {
  success: boolean;
  uniqueCustomers: number;
  shopify: { orders: number; revenue: number };
  printavo: { orders: number; revenue: number };
  updated: number;
  created: number;
  skipped: number;
  error?: string;
}

export function useHistoricalCustomerSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<HistoricalSyncResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const runSync = async (sources: string[] = ['shopify', 'printavo']) => {
    setIsSyncing(true);
    setLastResult(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300_000); // 5 min timeout

      const session = (await supabase.auth.getSession()).data.session;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(`${supabaseUrl}/functions/v1/historical-customer-revenue`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ sources, maxPages: 200 }),
      });
      clearTimeout(timeoutId);

      const data = await resp.json();
      if (!resp.ok) {
        const result: HistoricalSyncResult = {
          success: false, uniqueCustomers: 0,
          shopify: { orders: 0, revenue: 0 },
          printavo: { orders: 0, revenue: 0 },
          updated: 0, created: 0, skipped: 0,
          error: data?.error || `HTTP ${resp.status}`,
        };
        setLastResult(result);
        toast({ variant: 'destructive', title: 'Historical sync failed', description: result.error });
        return result;
      }

      const result = data as HistoricalSyncResult;
      setLastResult(result);

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        toast({
          title: 'Historical revenue sync complete',
          description: `${result.uniqueCustomers} customers processed. ${result.updated} updated, ${result.created} new. Shopify: $${result.shopify.revenue.toLocaleString()} (${result.shopify.orders} orders). Printavo: $${result.printavo.revenue.toLocaleString()} (${result.printavo.orders} invoices).`,
        });
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const result: HistoricalSyncResult = {
        success: false, uniqueCustomers: 0,
        shopify: { orders: 0, revenue: 0 },
        printavo: { orders: 0, revenue: 0 },
        updated: 0, created: 0, skipped: 0,
        error: errorMessage,
      };
      setLastResult(result);
      toast({ variant: 'destructive', title: 'Historical sync failed', description: errorMessage });
      return result;
    } finally {
      setIsSyncing(false);
    }
  };

  return { runSync, isSyncing, lastResult };
}
