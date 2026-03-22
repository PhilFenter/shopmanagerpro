import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface SyncOptions {
  startDate?: string;
  endDate?: string;
  minOrderNumber?: string;
  maxPages?: number;
}

interface SyncResult {
  success: boolean;
  imported: number;
  skipped: number;
  total: number;
  pages?: number;
  error?: string;
}

export function useShopifySync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const syncOrders = async (options: SyncOptions = {}) => {
    setIsSyncing(true);
    setLastResult(null);

    try {
      // Use raw fetch with extended timeout (3 min) since this sync can take a while
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180_000);

      const session = (await supabase.auth.getSession()).data.session;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(`${supabaseUrl}/functions/v1/shopify-sync`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          startDate: options.startDate || null,
          endDate: options.endDate || null,
          minOrderNumber: options.minOrderNumber || null,
          maxPages: options.maxPages || 20,
        }),
      });
      clearTimeout(timeoutId);

      const data = await resp.json();
      const error = resp.ok ? null : { message: data?.error || `HTTP ${resp.status}` };

      if (error) {
        console.error('Shopify sync error:', error);
        const result: SyncResult = {
          success: false,
          imported: 0,
          skipped: 0,
          total: 0,
          error: error.message,
        };
        setLastResult(result);
        toast({
          variant: 'destructive',
          title: 'Sync failed',
          description: error.message,
        });
        return result;
      }

      const result = data as SyncResult;
      setLastResult(result);

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['jobs'] });
        const pagesMsg = result.pages && result.pages > 1 ? ` across ${result.pages} pages` : '';
        const garmentsMsg = (result as any).garments ? `, ${(result as any).garments} garments` : '';
        const custCreated = (result as any).customersCreated || 0;
        const custUpdated = (result as any).customersUpdated || 0;
        const custMsg = (custCreated + custUpdated) > 0 ? ` | ${custCreated} new customers, ${custUpdated} updated` : '';
        toast({
          title: 'Shopify sync complete',
          description: `Imported ${result.imported} orders${pagesMsg}${garmentsMsg} (${result.skipped} already existed)${custMsg}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Sync failed',
          description: result.error || 'Unknown error',
        });
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const result: SyncResult = {
        success: false,
        imported: 0,
        skipped: 0,
        total: 0,
        error: errorMessage,
      };
      setLastResult(result);
      toast({
        variant: 'destructive',
        title: 'Sync failed',
        description: errorMessage,
      });
      return result;
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    syncOrders,
    isSyncing,
    lastResult,
  };
}
