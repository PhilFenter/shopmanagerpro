import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface PurchaseOrder {
  id: string;
  po_number: string | null;
  supplier: string;
  status: string;
  notes: string | null;
  created_by: string;
  submitted_at: string | null;
  total_items: number;
  total_cost: number;
  created_at: string;
  updated_at: string;
}

export interface POLineItem {
  id: string;
  po_id: string;
  style_number: string;
  color: string | null;
  size: string | null;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  brand: string | null;
  description: string | null;
  source: string | null;
  source_order_id: string | null;
  source_order_name: string | null;
  job_id: string | null;
  created_at: string;
}

export function usePurchaseOrders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PurchaseOrder[];
    },
  });

  const createPO = useMutation({
    mutationFn: async (supplier: string = 'sanmar') => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert({ supplier, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as PurchaseOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({ title: 'New PO draft created' });
    },
  });

  const deletePO = useMutation({
    mutationFn: async (poId: string) => {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', poId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({ title: 'PO deleted' });
    },
  });

  return { orders: ordersQuery.data || [], isLoading: ordersQuery.isLoading, createPO, deletePO };
}

export function usePOLineItems(poId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ['po-line-items', poId],
    queryFn: async () => {
      if (!poId) return [];
      const { data, error } = await supabase
        .from('po_line_items')
        .select('*')
        .eq('po_id', poId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as POLineItem[];
    },
    enabled: !!poId,
  });

  const addItems = useMutation({
    mutationFn: async (items: Omit<POLineItem, 'id' | 'created_at' | 'updated_at'>[]) => {
      const { error } = await supabase.from('po_line_items').insert(items as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-line-items', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({ title: 'Items added to PO' });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('po_line_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-line-items', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<POLineItem> & { id: string }) => {
      const { error } = await supabase.from('po_line_items').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-line-items', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });

  // Compute totals
  const items = itemsQuery.data || [];
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalCost = items.reduce((sum, i) => sum + (i.total_cost || 0), 0);
  const FREE_SHIPPING_THRESHOLD = 200;
  const shippingProgress = Math.min((totalCost / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const remainingForFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - totalCost, 0);

  return {
    items,
    isLoading: itemsQuery.isLoading,
    addItems,
    removeItem,
    updateItem,
    totalQty,
    totalCost,
    shippingProgress,
    remainingForFreeShipping,
    FREE_SHIPPING_THRESHOLD,
  };
}

export const INKSOFT_STORES = [
  { key: 'hcd_kiosk', label: 'HCD Kiosk' },
  { key: 'grangeville_helitack', label: 'Grangeville Helitack' },
  { key: 'tri_state_employee_store', label: 'Tri-State Employee Store' },
] as const;

export type InkSoftStoreKey = typeof INKSOFT_STORES[number]['key'];

export function useInkSoftOrders() {
  const fetchOrders = async (store: InkSoftStoreKey = 'hcd_kiosk') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const resp = await supabase.functions.invoke('inksoft-orders', {
      body: { action: 'list', store },
    });
    if (resp.error) throw resp.error;
    return resp.data;
  };

  const fetchOrderDetail = async (orderId: number, store: InkSoftStoreKey = 'hcd_kiosk') => {
    const resp = await supabase.functions.invoke('inksoft-orders', {
      body: { action: 'detail', orderId, store },
    });
    if (resp.error) throw resp.error;
    return resp.data;
  };

  return { fetchOrders, fetchOrderDetail };
}
