import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, FileText, Loader2, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useImportBatches } from '@/hooks/useProductionImports';
import { importWorkOrderPdf, type ImportStep } from '@/lib/production/importFile';
import { useIsProdManager } from '@/components/production/ProdShared';

const STEP_LABEL: Record<ImportStep, string> = {
  hashing: 'Checking the file…',
  checking: 'Looking for earlier uploads…',
  reading: 'Reading the work orders…',
  uploading: 'Saving the original PDF…',
  previews: 'Saving artwork previews…',
  saving: 'Saving for review…',
  done: 'Done',
};

export default function ProductionImports() {
  const isManager = useIsProdManager();
  const { data: batches, isLoading } = useImportBatches();
  const [pdf, setPdf] = useState<File | null>(null);
  const [csv, setCsv] = useState<File | null>(null);
  const [step, setStep] = useState<ImportStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const run = async () => {
    if (!pdf) return;
    setError(null);
    try {
      const r = await importWorkOrderPdf(pdf, csv, setStep);
      qc.invalidateQueries({ queryKey: ['prod'] });
      if (r.existing) toast.info('This exact file was already imported. Opening it — nothing new was created.');
      else {
        const n = r.results ?? [];
        const counts = n.reduce<Record<string, number>>((a, x) => ((a[x.outcome] = (a[x.outcome] ?? 0) + 1), a), {});
        const parts = [
          counts.new && `${counts.new} new`,
          counts.unchanged && `${counts.unchanged} already imported (no changes)`,
          counts.updated && `${counts.updated} updated`,
          counts.pending && `${counts.pending} changed after approval`,
        ].filter(Boolean);
        toast.success(`Imported ${n.length} order${n.length === 1 ? '' : 's'}${parts.length ? `: ${parts.join(', ')}` : ''}`);
      }
      navigate(`/production/imports/${r.batchId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStep(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">InkSoft Work Orders</h1>
        <p className="text-sm text-muted-foreground">
          Upload the work-order PDF from InkSoft. Adding the Orders CSV for the same orders fills in pickup location and department.
          Nothing goes to production until a manager approves each order.
        </p>
      </div>

      {isManager ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Import</CardTitle>
            <CardDescription>The original files are kept. Uploading the same file again opens the earlier import instead of creating duplicates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => pdfRef.current?.click()}
                className="flex items-center gap-3 rounded-lg border-2 border-dashed p-4 text-left hover:bg-accent"
              >
                <FileText className="h-8 w-8 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="font-medium">Work-order PDF (required)</div>
                  <div className="truncate text-sm text-muted-foreground">{pdf ? pdf.name : 'Choose WorkOrders….pdf'}</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => csvRef.current?.click()}
                className="flex items-center gap-3 rounded-lg border-2 border-dashed p-4 text-left hover:bg-accent"
              >
                <FileSpreadsheet className="h-8 w-8 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="font-medium">Orders CSV (optional)</div>
                  <div className="truncate text-sm text-muted-foreground">{csv ? csv.name : 'Choose InkSoft-Orders….csv'}</div>
                </div>
              </button>
              <input ref={pdfRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
              <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setCsv(e.target.files?.[0] ?? null)} />
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button onClick={run} disabled={!pdf || !!step}>
                {step ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {step ? STEP_LABEL[step] : 'Import'}
              </Button>
              {(pdf || csv) && !step && (
                <Button variant="ghost" onClick={() => { setPdf(null); setCsv(null); setError(null); }}>Clear</Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">Only a manager or admin can import work orders.</p>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Recent imports</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && (batches ?? []).length === 0 && <div className="p-4 text-sm text-muted-foreground">No imports yet.</div>}
          {(batches ?? []).map((b) => (
            <Link key={b.id} to={`/production/imports/${b.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-accent">
              {b.status === 'failed' ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{b.file_name}</div>
                <div className="text-xs text-muted-foreground">
                  Uploaded {new Date(b.created_at).toLocaleString()}
                  {b.printed_at && ` · InkSoft printed ${b.printed_at}`}
                  {b.csv_file_name && ' · with Orders CSV'}
                </div>
              </div>
              {b.summary && (
                <div className="text-sm text-muted-foreground">
                  {b.summary.orders} orders · {b.summary.garments} garments · {b.summary.tasks} decorations
                </div>
              )}
              {b.status === 'failed' && <Badge variant="destructive">Couldn’t read</Badge>}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
