import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProductCatalog, CatalogItem } from '@/hooks/useProductCatalog';
import { Upload, Search, Package, Loader2, Database, RefreshCw, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

function parsePrice(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    return parseFloat(value.replace(/[$,]/g, '')) || 0;
  }
  return 0;
}

type Supplier = 'sanmar' | 'ss_activewear';

const SUPPLIER_LABELS: Record<Supplier, string> = {
  sanmar: 'SanMar',
  ss_activewear: 'S&S Activewear',
};

export function ProductCatalogSettings() {
  const { stats, isLoading, searchCatalog, importCatalog } = useProductCatalog();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [parseStatus, setParseStatus] = useState('');
  const [bulkStyles, setBulkStyles] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncSupplier, setSyncSupplier] = useState<Supplier>('sanmar');
  const [isRepricing, setIsRepricing] = useState(false);
  const [repriceProgress, setRepriceProgress] = useState<{ processed: number; total: number } | null>(null);
  const [repriceResult, setRepriceResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBulkReprice = async (dryRun = false) => {
    setIsRepricing(true);
    setRepriceResult(null);
    setRepriceProgress(null);

    try {
      let offset = 0;
      let allDetails: any[] = [];
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
      let totalJobsReaggregated = 0;
      let totalStyles = 0;

      // Process in batches until no more
      while (true) {
        const { data, error } = await supabase.functions.invoke('bulk-reprice', {
          body: { dryRun, offset },
        });
        if (error) throw error;

        totalStyles = data.summary.totalStyles;
        totalUpdated += data.summary.garmentsUpdated;
        totalSkipped += data.summary.garmentsSkipped;
        totalErrors += data.summary.errors;
        totalJobsReaggregated += data.summary.jobsReaggregated;
        if (data.details) allDetails = [...allDetails, ...data.details];

        const processed = Math.min(offset + data.summary.batchProcessed, totalStyles);
        setRepriceProgress({ processed, total: totalStyles });

        if (!data.hasMore) break;
        offset = data.nextOffset;
      }

      const result = {
        dryRun,
        summary: {
          totalStyles,
          garmentsUpdated: totalUpdated,
          garmentsSkipped: totalSkipped,
          errors: totalErrors,
          jobsReaggregated: totalJobsReaggregated,
        },
        details: allDetails,
      };
      setRepriceResult(result);

      if (!dryRun && totalUpdated > 0) {
        toast.success(`Updated ${totalUpdated} garments across ${totalJobsReaggregated} jobs`);
      } else if (!dryRun && totalUpdated === 0) {
        toast.info('All garments already at correct wholesale prices');
      }
    } catch (err: any) {
      toast.error('Reprice failed: ' + err.message);
    } finally {
      setIsRepricing(false);
      setRepriceProgress(null);
    }
  };

  const handleBulkSync = async () => {
    const styles = bulkStyles.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
    if (styles.length === 0) return;
    setIsSyncing(true);
    setSyncStatus(`Syncing ${styles.length} style(s) from ${SUPPLIER_LABELS[syncSupplier]}...`);
    let synced = 0;

    const functionName = syncSupplier === 'ss_activewear' ? 'ss-activewear-api' : 'sanmar-api';

    for (const style of styles) {
      setSyncStatus(`Syncing ${style} from ${SUPPLIER_LABELS[syncSupplier]}... (${synced}/${styles.length})`);
      try {
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { action: 'syncProduct', styleNumber: style },
        });
        if (!error && data?.success && data?.upserted > 0) {
          synced++;
        }
      } catch {}
    }
    setSyncStatus(`Done! ${synced} of ${styles.length} styles synced from ${SUPPLIER_LABELS[syncSupplier]}.`);
    if (synced > 0) toast.success(`${synced} style(s) synced from ${SUPPLIER_LABELS[syncSupplier]}`);
    setIsSyncing(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchCatalog(searchQuery.trim());
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseStatus('Reading file...');

    try {
      const { read, utils } = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs' as any);
      
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(sheet);

      setParseStatus(`Parsed ${jsonData.length} rows. Importing...`);

      const rows = jsonData.map((row: any) => ({
        style_number: row['STYLE NUMBER'] || row['Style Number'] || row['style_number'] || '',
        description: row['STYLE DESCRIPTION'] || row['Style Description'] || row['description'] || '',
        brand: row['BRAND'] || row['Brand'] || row['brand'] || '',
        category: row['CATEGORY'] || row['Category'] || row['category'] || '',
        color_group: row['COLOR GROUP'] || row['Color Group'] || row['color_group'] || '',
        size_range: row['SIZE'] || row['Size'] || row['size_range'] || '',
        case_price: parsePrice(row['CASE PRICE'] || row['Case Price'] || row['case_price']),
        piece_price: parsePrice(row['PIECE PRICE'] || row['Piece Price'] || row['piece_price']),
        price_code: row['PRICE CODE'] || row['Price Code'] || row['price_code'] || '',
        msrp: parsePrice(row['MSRP'] || row['msrp']),
        map_price: parsePrice(row['MAP'] || row['map_price']),
      })).filter((r: any) => r.style_number);

      const CHUNK_SIZE = 2000;
      let totalInserted = 0;

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        setParseStatus(`Importing batch ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(rows.length / CHUNK_SIZE)}...`);
        
        const result = await importCatalog.mutateAsync({
          rows: chunk,
          supplier: 'sanmar',
          clearExisting: i === 0,
        });
        totalInserted += result.inserted;
      }

      setParseStatus(`Done! ${totalInserted} items imported.`);
    } catch (err: any) {
      setParseStatus(`Error: ${err.message}`);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Product Catalog
        </CardTitle>
        <CardDescription>
          Supplier pricing for automated garment cost lookups (SanMar &amp; S&amp;S Activewear)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Database className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              {isLoading ? '...' : `${stats?.totalRows?.toLocaleString() || 0} items`} in catalog
            </p>
            <p className="text-xs text-muted-foreground">SanMar + S&amp;S Activewear pricing data</p>
          </div>
        </div>

        {/* Bulk Wholesale Reprice */}
        <div className="space-y-2 p-3 border border-dashed border-primary/30 rounded-lg bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                Bulk Wholesale Reprice
              </p>
              <p className="text-xs text-muted-foreground">
                Update ALL job garments with wholesale rates (SanMar → S&amp;S fallback)
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkReprice(true)}
                disabled={isRepricing}
              >
                {isRepricing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Preview
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleBulkReprice(false)}
                disabled={isRepricing}
              >
                {isRepricing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Reprice All Jobs
              </Button>
            </div>
          </div>

          {isRepricing && repriceProgress && (
            <div className="space-y-1">
              <Progress value={(repriceProgress.processed / repriceProgress.total) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Processing {repriceProgress.processed} of {repriceProgress.total} styles...
              </p>
            </div>
          )}

          {repriceResult && (
            <Alert className="mt-2">
              <AlertDescription>
                <div className="text-sm space-y-1">
                  {repriceResult.dryRun && (
                    <p className="font-medium text-amber-600">⚠️ DRY RUN — no changes made</p>
                  )}
                  <p>
                    <strong>{repriceResult.summary?.totalStyles}</strong> styles checked · 
                    <strong> {repriceResult.summary?.garmentsUpdated}</strong> garments {repriceResult.dryRun ? 'would be' : ''} updated · 
                    <strong> {repriceResult.summary?.jobsReaggregated}</strong> jobs {repriceResult.dryRun ? 'would be' : ''} re-aggregated
                  </p>
                  {repriceResult.summary?.errors > 0 && (
                    <p className="text-destructive text-xs">{repriceResult.summary.errors} errors encountered</p>
                  )}
                  {repriceResult.details?.length > 0 && (
                    <div className="max-h-48 overflow-y-auto mt-2 border rounded divide-y text-xs">
                      {repriceResult.details.map((d: any, i: number) => (
                        <div key={i} className="flex justify-between px-2 py-1">
                          <span className="font-mono">{d.style}</span>
                          <span>
                            {d.oldPrice > 0 && <span className="text-muted-foreground line-through mr-1">${d.oldPrice.toFixed(2)}</span>}
                            {d.newPrice > 0 && <span className="text-primary font-medium">${d.newPrice.toFixed(2)}</span>}
                            {d.source && d.source !== 'none' && (
                              <Badge variant="outline" className="ml-1 text-[10px] py-0">
                                {d.source === 'ss_activewear' ? 'S&S' : 'SanMar'}
                              </Badge>
                            )}
                            <span className="text-muted-foreground ml-2">({d.status})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importCatalog.isPending}
              className="flex-1"
            >
              {importCatalog.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Upload Price List (.xlsx)
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          {parseStatus && (
            <p className="text-xs text-muted-foreground">{parseStatus}</p>
          )}
        </div>

        {/* Bulk Sync */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Sync from Supplier API</p>
          <div className="flex gap-2">
            <Select value={syncSupplier} onValueChange={(v) => setSyncSupplier(v as Supplier)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sanmar">SanMar</SelectItem>
                <SelectItem value="ss_activewear">S&amp;S Activewear</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Style numbers (e.g. PC61, 6210, SS4500)"
              value={bulkStyles}
              onChange={(e) => setBulkStyles(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBulkSync()}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleBulkSync}
              disabled={isSyncing || !bulkStyles.trim()}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync
            </Button>
          </div>
          {syncStatus && (
            <p className="text-xs text-muted-foreground">{syncStatus}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Search by style number (e.g. PC54, SS4500)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button variant="outline" size="icon" onClick={handleSearch} disabled={isSearching}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
              {searchResults.map((item) => (
                <div key={item.id} className="p-2 text-sm flex justify-between items-center">
                  <div>
                    <span className="font-mono font-medium">{item.style_number}</span>
                    <span className="text-muted-foreground ml-2">{item.description}</span>
                    {item.size_range && (
                      <Badge variant="outline" className="ml-2 text-xs">{item.size_range}</Badge>
                    )}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {item.supplier === 'ss_activewear' ? 'S&S' : 'SanMar'}
                    </Badge>
                  </div>
                  <span className="font-mono text-primary">
                    ${item.piece_price?.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
