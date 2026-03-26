import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useGarmentInventory, InventoryItem } from '@/hooks/useGarmentInventory';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { InventoryFormDialog } from '@/components/inventory/InventoryFormDialog';
import { Search, Plus, Upload, Package, DollarSign, MapPin, Pencil, Trash2, Loader2, Minus } from 'lucide-react';

function parsePrice(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value.replace(/[$,]/g, '')) || 0;
  return 0;
}

const EMPTY_FORM: Partial<InventoryItem> = {
  style_number: '',
  color: '',
  size: '',
  quantity: 0,
  unit_cost: 0,
  location: '',
  bin: '',
  brand: '',
  description: '',
  notes: '',
};

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<Partial<InventoryItem>>(EMPTY_FORM);
  const [importStatus, setImportStatus] = useState('');
  const [bulkLookupRunning, setBulkLookupRunning] = useState(false);
  const [bulkLookupProgress, setBulkLookupProgress] = useState('');
  const [deductDialogItem, setDeductDialogItem] = useState<InventoryItem | null>(null);
  const [deductQty, setDeductQty] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const { items, isLoading, totalValue, totalItems, distincts, addItem, updateItem, deleteItem, bulkImport } = useGarmentInventory(debouncedSearch);

  const bulkCostLookup = useCallback(async () => {
    const needsPricing = items.filter(i => !i.unit_cost || i.unit_cost === 0);
    if (needsPricing.length === 0) {
      toast.info('All items already have costs');
      return;
    }

    setBulkLookupRunning(true);
    const styleMap = new Map<string, InventoryItem[]>();
    for (const item of needsPricing) {
      const style = item.style_number.trim().toUpperCase();
      if (!styleMap.has(style)) styleMap.set(style, []);
      styleMap.get(style)!.push(item);
    }

    let updated = 0;
    let failed = 0;
    const styles = [...styleMap.entries()];

    for (let i = 0; i < styles.length; i++) {
      const [style, styleItems] = styles[i];
      setBulkLookupProgress(`Looking up ${style} (${i + 1}/${styles.length})...`);

      try {
        // Try SanMar API first for wholesale pricing (myPrice)
        let found = false;
        try {
          const sanmarRes = await supabase.functions.invoke('sanmar-api', {
            body: { action: 'getPricing', styleNumber: style },
          });
          if (sanmarRes.data?.success && sanmarRes.data.pricing?.length > 0) {
            const pricing = sanmarRes.data.pricing;
            for (const item of styleItems) {
              const enteredSize = item.size?.trim().toUpperCase();
              let matched = enteredSize
                ? pricing.filter((p: any) => p.size?.toUpperCase() === enteredSize)
                : [];
              if (matched.length === 0)
                matched = pricing.filter((p: any) => ['S', 'M', 'L', 'XL'].includes(p.size?.toUpperCase()));
              if (matched.length === 0) matched = pricing;
              
              const price = matched.map((p: any) => p.myPrice || p.salePrice || p.casePrice || 0).find((p: number) => p > 0);
              if (price) {
                await updateItem.mutateAsync({ id: item.id, unit_cost: price });
                updated++;
                found = true;
              }
            }
            if (found) continue;
          }
        } catch (e) {
          console.log('SanMar lookup failed for', style, e);
        }

        // Fallback to local catalog
        const { data: catalogHit } = await supabase
          .from('product_catalog')
          .select('piece_price, brand, description')
          .ilike('style_number', style)
          .gt('piece_price', 0)
          .order('piece_price', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (catalogHit?.piece_price) {
          for (const item of styleItems) {
            await updateItem.mutateAsync({ id: item.id, unit_cost: catalogHit.piece_price, ...(catalogHit.brand && !item.brand ? { brand: catalogHit.brand } : {}) });
            updated++;
          }
          continue;
        }

        try {
          const ssRes = await supabase.functions.invoke('ss-activewear-api', {
            body: { action: 'getProducts', styleNumber: style },
          });
          if (ssRes.data?.success && ssRes.data.products?.length > 0) {
            const products = ssRes.data.products;
            for (const item of styleItems) {
              const enteredSize = item.size?.trim().toUpperCase();
              let matched = enteredSize
                ? products.filter((p: any) => (p.sizeName || p.size || '').toUpperCase() === enteredSize)
                : [];
              if (matched.length === 0)
                matched = products.filter((p: any) => ['S', 'M', 'L', 'XL'].includes((p.sizeName || p.size || '').toUpperCase()));
              if (matched.length === 0) matched = products;

              const price = matched.map((p: any) => parseFloat(p.customerPrice) || parseFloat(p.casePrice) || 0).find((p: number) => p > 0);
              if (price) {
                await updateItem.mutateAsync({ id: item.id, unit_cost: price, ...(ssRes.data.styleInfo?.brandName && !item.brand ? { brand: ssRes.data.styleInfo.brandName } : {}) });
                updated++;
                found = true;
              }
            }
            if (found) continue;
          }
        } catch { /* skip */ }

        failed += styleItems.length;
      } catch {
        failed += styleItems.length;
      }
    }

    setBulkLookupRunning(false);
    setBulkLookupProgress('');
    toast.success(`Cost lookup complete: ${updated} updated, ${failed} not found`);
  }, [items, updateItem]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(val), 300);
  };

  const openAdd = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setForm({
      style_number: item.style_number,
      color: item.color || '',
      size: item.size || '',
      quantity: item.quantity,
      unit_cost: item.unit_cost || 0,
      location: item.location || '',
      bin: item.bin || '',
      brand: item.brand || '',
      description: item.description || '',
      notes: item.notes || '',
    });
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!form.style_number?.trim()) return;
    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, ...form });
    } else {
      addItem.mutate(form);
    }
    setFormOpen(false);
  };

  const handleDeduct = () => {
    if (!deductDialogItem || deductQty <= 0) return;
    const newQty = Math.max(0, deductDialogItem.quantity - deductQty);
    updateItem.mutate({ id: deductDialogItem.id, quantity: newQty });
    setDeductDialogItem(null);
    setDeductQty(1);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('Reading file...');
    try {
      const { read, utils } = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs' as any);
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(sheet, { defval: '' });

      setImportStatus(`Parsed ${jsonData.length} rows. Processing...`);

      // Carry-forward logic for merged/inherited cells
      let lastBrand = '';
      let lastStyle = '';
      let lastColor = '';
      let lastLocation = '';
      let lastStyleNumber = '';

      const rows: Partial<InventoryItem>[] = [];

      for (const raw of jsonData as any[]) {
        const brand = String(raw['Brand'] || raw['BRAND'] || raw['brand'] || '').trim();
        const style = String(raw['Style'] || raw['Style Number'] || raw['STYLE'] || raw['style_number'] || raw['Item'] || '').trim();
        const color = String(raw['Color'] || raw['COLOR'] || raw['color'] || '').trim();
        const size = String(raw['Size'] || raw['SIZE'] || raw['size'] || '').trim();
        const qtyRaw = raw['Amount'] || raw['Qty'] || raw['Quantity'] || raw['QTY'] || raw['quantity'] || '';
        const quantity = parseInt(String(qtyRaw)) || 0;
        const location = String(raw['Location'] || raw['LOCATION'] || raw['location'] || '').trim();
        const styleNum = String(raw['#'] || raw['Style #'] || '').trim();
        const cost = parsePrice(raw['Cost'] || raw['Unit Cost'] || raw['COST'] || raw['unit_cost']);
        const bin = String(raw['Bin'] || raw['BIN'] || raw['bin'] || '').trim() || null;
        const description = String(raw['Description'] || raw['DESCRIPTION'] || raw['description'] || '').trim() || null;
        const notes = String(raw['Notes'] || raw['NOTES'] || raw['notes'] || '').trim() || null;

        // Apply carry-forward: if cell is empty, use previous value
        if (brand) lastBrand = brand;
        if (style) lastStyle = style;
        if (color) lastColor = color;
        if (location) lastLocation = location;
        if (styleNum) lastStyleNumber = styleNum;

        // Skip rows without size or quantity
        if (!size || quantity <= 0) continue;

        rows.push({
          brand: lastBrand || null,
          style_number: lastStyleNumber || lastStyle || 'UNKNOWN',
          description: lastStyle || description,
          color: lastColor || null,
          size,
          quantity,
          unit_cost: cost || null,
          location: lastLocation || null,
          bin,
          notes,
        });
      }

      setImportStatus(`Found ${rows.length} inventory items. Importing...`);
      const inserted = await bulkImport.mutateAsync(rows);
      setImportStatus(`Done! ${inserted} items imported.`);
    } catch (err: any) {
      setImportStatus(`Error: ${err.message}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateField = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Garment Inventory</h1>
          <p className="text-muted-foreground">Track loose garment stock across all locations</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={bulkCostLookup} disabled={bulkLookupRunning}>
            {bulkLookupRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DollarSign className="h-4 w-4 mr-2" />}
            {bulkLookupRunning ? 'Looking up...' : 'Bulk Cost Lookup'}
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import XLS
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {(importStatus || bulkLookupProgress) && (
        <p className="text-sm text-muted-foreground">{bulkLookupProgress || importStatus}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{isLoading ? '...' : items.length}</p>
              <p className="text-sm text-muted-foreground">SKUs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{isLoading ? '...' : totalItems.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Pieces</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">${isLoading ? '...' : totalValue.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Total Value</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by style, color, brand, location..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Style</TableHead>
                <TableHead className="hidden sm:table-cell">Brand</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Cost</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No inventory items found
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <span className="font-mono font-medium">{item.style_number}</span>
                        {item.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{item.brand || '—'}</TableCell>
                    <TableCell>{item.color || '—'}</TableCell>
                    <TableCell>
                      {item.size ? <Badge variant="outline">{item.size}</Badge> : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={item.quantity <= 0}
                          onClick={() => updateItem.mutate({ id: item.id, quantity: Math.max(0, item.quantity - 1) })}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className={`min-w-[2ch] text-center ${item.quantity <= 0 ? 'text-destructive' : item.quantity <= 5 ? 'text-amber-500' : ''}`}>
                          {item.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateItem.mutate({ id: item.id, quantity: item.quantity + 1 })}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell font-mono">
                      {item.unit_cost ? `$${item.unit_cost.toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {item.location || item.bin ? (
                        <span className="flex items-center gap-1 text-xs">
                          <MapPin className="h-3 w-3" />
                          {[item.location, item.bin].filter(Boolean).join(' / ')}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete inventory item?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove {item.style_number} {item.color} {item.size} from inventory.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteItem.mutate(item.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Deduct Dialog */}
      <Dialog open={!!deductDialogItem} onOpenChange={(open) => !open && setDeductDialogItem(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Use from Inventory</DialogTitle>
          </DialogHeader>
          {deductDialogItem && (
            <div className="space-y-4">
              <p className="text-sm">
                <span className="font-mono font-medium">{deductDialogItem.style_number}</span>
                {' '}{deductDialogItem.color} {deductDialogItem.size}
                <span className="text-muted-foreground ml-2">({deductDialogItem.quantity} in stock)</span>
              </p>
              <div>
                <Label>Quantity to deduct</Label>
                <Input
                  type="number"
                  min={1}
                  max={deductDialogItem.quantity}
                  value={deductQty}
                  onChange={(e) => setDeductQty(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeductDialogItem(null)}>Cancel</Button>
                <Button onClick={handleDeduct} disabled={deductQty <= 0 || deductQty > deductDialogItem.quantity}>
                  Deduct {deductQty}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <InventoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingItem={editingItem}
        form={form}
        updateField={updateField}
        onSave={handleSave}
        distincts={distincts}
      />
    </div>
  );
}
