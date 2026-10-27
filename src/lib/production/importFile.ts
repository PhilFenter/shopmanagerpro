// Browser-side import: hash → duplicate check → keep the original → read → save for review.
import { extractPdf, imageToPngBlob, sha256File } from './pdfExtract';
import { parseWorkOrders, type ParsedBatch } from './inksoftParser';
import { parseInkSoftOrdersCsv, type CsvOrder } from './inksoftCsv';
import { buildImportPayload, csvToPayload, type ImportPayload } from './importPayload';
import type { MethodRule } from './methods';
import { prodDb, rpc, uploadOnce } from './db';

/* eslint-disable @typescript-eslint/no-explicit-any */
let pdfjsPromise: Promise<any> | null = null;
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

export type ImportStep = 'hashing' | 'checking' | 'uploading' | 'reading' | 'previews' | 'saving' | 'done';

export interface ImportResult {
  batchId: string;
  existing: boolean;
  parsed?: ParsedBatch;
  results?: { order_number: string; order_id: string; outcome: string; revision: number }[];
}

async function loadRules(): Promise<MethodRule[]> {
  const { data, error } = await prodDb.from('prod_method_rules').select('store_name, method_inksoft, method_production, note').eq('active', true);
  if (error) throw new Error(error.message);
  return (data ?? []) as MethodRule[];
}

export async function readCsvFile(file: File): Promise<{ orders: CsvOrder[]; sha: string; text: string }> {
  const buf = await file.arrayBuffer();
  const text = new TextDecoder('utf-8').decode(buf);
  const r = parseInkSoftOrdersCsv(text);
  if (r.error) throw new Error(r.error);
  return { orders: r.orders, sha: await sha256File(buf), text };
}

export async function importWorkOrderPdf(
  file: File,
  csvFile: File | null,
  onStep: (s: ImportStep) => void = () => {},
): Promise<ImportResult> {
  onStep('hashing');
  const buf = new Uint8Array(await file.arrayBuffer());
  const sha = await sha256File(buf);
  const csv = csvFile ? await readCsvFile(csvFile) : null;

  onStep('checking');
  const pdfPath = `pdf/${sha}.pdf`;
  const pdfjs = await loadPdfjs();
  // read first (cheap, local) so we know the page count and fail early on a non-PDF
  onStep('reading');
  const extracted = await extractPdf(pdfjs, buf.slice(), { keepOpen: true });
  try {
    const created = await rpc<{ batch_id: string; existing: boolean }>('prod_create_batch', {
      p_file_name: file.name,
      p_storage_path: pdfPath,
      p_file_sha256: sha,
      p_page_count: extracted.pages.length,
    });
    if (created.existing) {
      if (csv) await attachCsv(created.batch_id, csvFile!, csv);
      return { batchId: created.batch_id, existing: true };
    }

    onStep('uploading');
    await uploadOnce(pdfPath, new Blob([buf], { type: 'application/pdf' }), 'application/pdf');

    let parsed: ParsedBatch;
    let payload: ImportPayload;
    try {
      parsed = parseWorkOrders(extracted);
      onStep('previews');
      const previews = await uploadPreviews(extracted.doc, parsed);
      payload = await buildImportPayload(parsed, await loadRules(), csv?.orders ?? null, previews);
    } catch (e) {
      await rpc('prod_mark_batch_failed', { p_batch_id: created.batch_id, p_error: String((e as Error)?.message ?? e) }).catch(() => {});
      throw e;
    }

    onStep('saving');
    const results = await rpc<ImportResult['results']>('prod_save_extraction', {
      p_batch_id: created.batch_id,
      p_payload: payload,
    });
    if (csv) await attachCsv(created.batch_id, csvFile!, csv, true);
    onStep('done');
    return { batchId: created.batch_id, existing: false, parsed, results };
  } finally {
    await extracted.doc?.destroy?.();
  }
}

/** Keep the CSV and apply its pickup/department fields to orders already imported. */
export async function attachCsv(batchId: string, file: File, csv: { orders: CsvOrder[]; sha: string }, alreadyApplied = false) {
  const path = `csv/${csv.sha}.csv`;
  await uploadOnce(path, file, 'text/csv');
  return rpc<{ matched: number; unmatched: string[] }>('prod_apply_csv', {
    p_batch_id: batchId,
    p_file_name: file.name,
    p_storage_path: path,
    p_sha256: csv.sha,
    // when the CSV went in with the PDF its fields are already saved; this only records the file
    p_orders: alreadyApplied ? [] : csv.orders.map((c) => ({ order_number: c.orderNumber, ...csvToPayload(c) })),
  });
}

async function uploadPreviews(doc: any, parsed: ParsedBatch): Promise<ImportPayload['previews']> {
  const seen = new Map<string, ImportPayload['previews'][number]>();
  const refs: { kind: 'artwork' | 'mockup'; page: number; hash: string; pw: number; ph: number; objId?: string }[] = [];
  for (const o of parsed.orders)
    for (const it of o.items)
      for (const d of it.decorations) {
        if (d.artwork) refs.push({ kind: 'artwork', ...d.artwork });
        if (d.mockup) refs.push({ kind: 'mockup', ...d.mockup });
      }
  for (const r of refs) {
    if (!r.hash || !r.objId || seen.has(r.hash)) continue;
    const blob = await imageToPngBlob(doc, r.page, r.objId);
    if (!blob) continue; // no preview is fine; the review screen says so
    const path = `previews/${r.hash}.png`;
    await uploadOnce(path, blob, 'image/png');
    seen.set(r.hash, { hash: r.hash, kind: r.kind, storage_path: path, width_px: r.pw, height_px: r.ph });
  }
  return [...seen.values()];
}
