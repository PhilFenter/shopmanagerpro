import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { prodDb, rpc, signedUrls } from '@/lib/production/db';
import type { DbItem, DbOrder } from '@/lib/production/review';
import type { TransferSourceDecoration } from '@/lib/production/transfers';

export interface ImportBatch {
  id: string;
  file_name: string;
  storage_path: string;
  page_count: number | null;
  csv_file_name: string | null;
  csv_storage_path: string | null;
  status: 'uploaded' | 'parsed' | 'failed';
  printed_at: string | null;
  summary: { orders: number; garments: number; tasks: number; labels: number } | null;
  parse_flags: { level: string; message: string }[];
  error: string | null;
  created_at: string;
}

export interface BatchOrder {
  source: { outcome: string; revision: number; pages: number[] };
  order: DbOrder;
  items: DbItem[];
}

const ITEM_SELECT = '*, prod_item_sizes(*), prod_item_decorations(*)';

export function useImportBatches() {
  return useQuery({
    queryKey: ['prod', 'batches'],
    queryFn: async () => {
      const { data, error } = await prodDb.from('prod_import_batches').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as ImportBatch[];
    },
  });
}

function sortItems(items: DbItem[]) {
  for (const it of items) {
    it.prod_item_sizes.sort((a, b) => a.seq - b.seq);
    it.prod_item_decorations.sort((a, b) => a.seq - b.seq);
  }
  return items.sort((a, b) => (a.item_index ?? 0) - (b.item_index ?? 0));
}

export function useImportBatch(batchId: string | undefined) {
  return useQuery({
    queryKey: ['prod', 'batch', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data: batch, error: e1 } = await prodDb.from('prod_import_batches').select('*').eq('id', batchId).single();
      if (e1) throw new Error(e1.message);
      const { data: sources, error: e2 } = await prodDb
        .from('prod_order_sources')
        .select('order_id, outcome, revision, pages')
        .eq('batch_id', batchId);
      if (e2) throw new Error(e2.message);
      const ids = (sources ?? []).map((s) => s.order_id as string);
      const [{ data: orders, error: e3 }, { data: items, error: e4 }] = await Promise.all([
        prodDb.from('prod_orders').select('*').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
        prodDb.from('prod_order_items').select(ITEM_SELECT).in('order_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
      ]);
      if (e3) throw new Error(e3.message);
      if (e4) throw new Error(e4.message);
      const byOrder = new Map<string, DbItem[]>();
      for (const it of (items ?? []) as (DbItem & { order_id: string })[]) {
        if (!byOrder.has(it.order_id)) byOrder.set(it.order_id, []);
        byOrder.get(it.order_id)!.push(it);
      }
      const list: BatchOrder[] = (sources ?? [])
        .map((s) => {
          const order = (orders ?? []).find((o) => o.id === s.order_id) as DbOrder | undefined;
          if (!order) return null;
          return {
            source: { outcome: s.outcome as string, revision: s.revision as number, pages: (s.pages as number[]) ?? [] },
            order,
            items: sortItems(byOrder.get(order.id) ?? []),
          };
        })
        .filter(Boolean) as BatchOrder[];
      list.sort((a, b) => (a.source.pages[0] ?? 0) - (b.source.pages[0] ?? 0));
      return { batch: batch as ImportBatch, orders: list };
    },
  });
}

/** Signed URLs for preview images, by hash. */
export function usePreviewUrls(hashes: string[]) {
  const key = [...new Set(hashes)].sort();
  return useQuery({
    queryKey: ['prod', 'previews', key],
    enabled: key.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await prodDb.from('prod_artwork_previews').select('hash, storage_path').in('hash', key);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { hash: string; storage_path: string }[];
      const urls = await signedUrls(rows.map((r) => r.storage_path));
      const out: Record<string, string> = {};
      for (const r of rows) if (urls[r.storage_path]) out[r.hash] = urls[r.storage_path];
      return out;
    },
  });
}

export function useTransferRows() {
  return useQuery({
    queryKey: ['prod', 'transfers'],
    queryFn: async () => {
      const { data: orders, error: e1 } = await prodDb
        .from('prod_orders')
        .select('id, order_number, store_name, due_date')
        .eq('status', 'approved');
      if (e1) throw new Error(e1.message);
      const ids = (orders ?? []).map((o) => o.id as string);
      if (ids.length === 0) return [] as (TransferSourceDecoration & { due_date: string | null })[];
      const { data: items, error: e2 } = await prodDb.from('prod_order_items').select(ITEM_SELECT).in('order_id', ids);
      if (e2) throw new Error(e2.message);
      const rows: (TransferSourceDecoration & { due_date: string | null })[] = [];
      for (const it of (items ?? []) as (DbItem & { order_id: string })[]) {
        const o = orders!.find((x) => x.id === it.order_id)!;
        for (const d of it.prod_item_decorations) {
          if (d.method_production !== 'dtf') continue;
          rows.push({
            decoration_id: d.id,
            order_number: o.order_number as string,
            store_name: (o.store_name as string) ?? null,
            due_date: (o.due_date as string) ?? null,
            mfg_sku: it.mfg_sku,
            color: it.color,
            design_id: it.design_id,
            design_name: it.design_name,
            colorway: d.colorway,
            location: d.location,
            method_inksoft: d.method_inksoft,
            artwork_hash: d.artwork_hash,
            transfer_printed_at: d.transfer_printed_at,
            sizes: it.prod_item_sizes.map((s) => ({ size: s.size, quantity: s.quantity })),
          });
        }
      }
      return rows;
    },
  });
}

/** Generic RPC mutation that refreshes production queries and shows errors. */
export function useProdAction<A extends Record<string, unknown>, R = unknown>(fn: string, success?: string | ((r: R) => string | null)) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => rpc<R>(fn, args),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['prod'] });
      const msg = typeof success === 'function' ? success(r) : success;
      if (msg) toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
