import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface CatalogItem {
  id: string;
  style_number: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  color_group: string | null;
  size_range: string | null;
  case_price: number;
  piece_price: number;
  price_code: string | null;
  msrp: number;
  map_price: number;
  supplier: string;
  created_at: string;
  updated_at: string;
}

export function useProductCatalog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const catalogQuery = useQuery({
    queryKey: ['product-catalog-stats'],
    queryFn: async () => {
      // Get count and sample of unique styles
      const { count, error } = await supabase
        .from('product_catalog')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      return { totalRows: count || 0 };
    },
  });

  const searchCatalog = async (styleNumber: string): Promise<CatalogItem[]> => {
    const { data, error } = await supabase
      .from('product_catalog')
      .select('*')
      .ilike('style_number', `%${styleNumber}%`)
      .limit(20);

    if (error) throw error;
    return data as CatalogItem[];
  };

  const lookupPrice = async (styleNumber: string, sizeRange?: string): Promise<number | null> => {
    let query = supabase
      .from('product_catalog')
      .select('piece_price, case_price')
      .eq('style_number', styleNumber.toUpperCase().trim());

    if (sizeRange) {
      query = query.eq('size_range', sizeRange);
    }

    const { data, error } = await query.limit(1).single();
    if (error || !data) return null;
    return data.piece_price || data.case_price || null;
  };

  const importCatalog = useMutation({
    mutationFn: async ({ rows, supplier, clearExisting }: { 
      rows: any[]; 
      supplier?: string; 
      clearExisting?: boolean;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-catalog`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            rows,
            supplier: supplier || 'sanmar',
            clear_existing: clearExisting || false,
          }),
        }
      );

      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-catalog-stats'] });
      toast({ title: `Catalog imported: ${data.inserted} items` });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Import failed', description: error.message });
    },
  });

  return {
    stats: catalogQuery.data,
    isLoading: catalogQuery.isLoading,
    searchCatalog,
    lookupPrice,
    importCatalog,
  };
}
