import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface InventoryItem {
  id: string;
  style_number: string;
  color: string | null;
  size: string | null;
  quantity: number;
  unit_cost: number | null;
  location: string | null;
  bin: string | null;
  brand: string | null;
  description: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useGarmentInventory(search?: string) {
  const queryClient = useQueryClient();

  const inventoryQuery = useQuery({
    queryKey: ['garment-inventory', search],
    queryFn: async () => {
      let query = supabase
        .from('garment_inventory')
        .select('*')
        .order('style_number', { ascending: true })
        .order('color', { ascending: true })
        .order('size', { ascending: true });

      if (search?.trim()) {
        query = query.or(
          `style_number.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%,color.ilike.%${search.trim()}%,brand.ilike.%${search.trim()}%,location.ilike.%${search.trim()}%`
        );
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data as InventoryItem[];
    },
  });

  // Fetch distinct values for dropdowns
  const distinctsQuery = useQuery({
    queryKey: ['garment-inventory-distincts'],
    queryFn: async () => {
      const [brandsRes, colorsRes, sizesRes, locationsRes] = await Promise.all([
        supabase.from('garment_inventory').select('brand').not('brand', 'is', null).order('brand'),
        supabase.from('garment_inventory').select('color').not('color', 'is', null).order('color'),
        supabase.from('garment_inventory').select('size').not('size', 'is', null).order('size'),
        supabase.from('garment_inventory').select('location').not('location', 'is', null).order('location'),
      ]);
      const unique = (arr: any[], key: string) => [...new Set((arr || []).map(r => r[key]).filter(Boolean))].sort();
      return {
        brands: unique(brandsRes.data || [], 'brand'),
        colors: unique(colorsRes.data || [], 'color'),
        sizes: unique(sizesRes.data || [], 'size'),
        locations: unique(locationsRes.data || [], 'location'),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const addItem = useMutation({
    mutationFn: async (item: Partial<InventoryItem>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('garment_inventory')
        .insert({ ...item, created_by: user?.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garment-inventory'] });
      toast.success('Item added to inventory');
    },
    onError: (e) => toast.error(`Failed to add: ${e.message}`),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InventoryItem> & { id: string }) => {
      const { error } = await supabase
        .from('garment_inventory')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garment-inventory'] });
      toast.success('Inventory updated');
    },
    onError: (e) => toast.error(`Failed to update: ${e.message}`),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('garment_inventory')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['garment-inventory'] });
      toast.success('Item removed');
    },
    onError: (e) => toast.error(`Failed to delete: ${e.message}`),
  });

  const bulkImport = useMutation({
    mutationFn: async (rows: Partial<InventoryItem>[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      const BATCH = 500;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH).map(r => ({
          ...r,
          created_by: user?.id,
        }));
        const { data, error } = await supabase
          .from('garment_inventory')
          .insert(batch as any[])
          .select('id');
        if (error) throw error;
        inserted += data?.length || 0;
      }
      return inserted;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['garment-inventory'] });
      toast.success(`${count} items imported`);
    },
    onError: (e) => toast.error(`Import failed: ${e.message}`),
  });

  const totalValue = (inventoryQuery.data || []).reduce(
    (sum, item) => sum + (item.quantity * (item.unit_cost || 0)),
    0
  );

  const totalItems = (inventoryQuery.data || []).reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return {
    items: inventoryQuery.data || [],
    isLoading: inventoryQuery.isLoading,
    totalValue,
    totalItems,
    addItem,
    updateItem,
    deleteItem,
    bulkImport,
  };
}
