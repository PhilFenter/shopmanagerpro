import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PricingMatrixRow {
  quantity: number;
  prices: number[];
  markup: number;
}

export interface PricingMatrix {
  id: string;
  name: string;
  service_type: string;
  column_headers: string[];
  rows: PricingMatrixRow[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function usePricingMatrices() {
  const matricesQuery = useQuery({
    queryKey: ['pricing-matrices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_matrices')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        ...m,
        column_headers: m.column_headers as string[],
        rows: m.rows as PricingMatrixRow[],
      })) as PricingMatrix[];
    },
  });

  const lookupPrice = (
    matrix: PricingMatrix,
    quantity: number,
    columnIndex: number
  ): { decorationCost: number; markup: number } | null => {
    if (!matrix.rows.length) return null;

    // Find the appropriate quantity tier (largest tier <= quantity)
    let tier = matrix.rows[0];
    for (const row of matrix.rows) {
      if (quantity >= row.quantity) {
        tier = row;
      } else {
        break;
      }
    }

    const price = tier.prices[columnIndex];
    if (price === undefined) return null;

    return { decorationCost: price, markup: tier.markup };
  };

  return {
    matrices: matricesQuery.data ?? [],
    isLoading: matricesQuery.isLoading,
    lookupPrice,
  };
}
