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

export function usePrintavoSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const syncOrders = async (options: SyncOptions = {}) => {
    setIsSyncing(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('printavo-sync', {
        body: { 
          startDate: options.startDate || null,
          endDate: options.endDate || null,
          minOrderNumber: options.minOrderNumber || null,
          maxPages: options.maxPages || 20, // Allow more pages for historical imports
        },
      });

      if (error) {
        console.error('Printavo sync error:', error);
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
        toast({
          title: 'Printavo sync complete',
          description: `Imported ${result.imported} orders${pagesMsg} (${result.skipped} already existed)`,
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
