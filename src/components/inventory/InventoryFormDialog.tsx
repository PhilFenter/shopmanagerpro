import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ComboSelect } from './ComboSelect';
import { InventoryItem } from '@/hooks/useGarmentInventory';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

interface InventoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: InventoryItem | null;
  form: Partial<InventoryItem>;
  updateField: (key: string, value: any) => void;
  onSave: () => void;
  distincts: { brands: string[]; colors: string[]; sizes: string[]; locations: string[] };
}

export function InventoryFormDialog({
  open, onOpenChange, editingItem, form, updateField, onSave, distincts
}: InventoryFormDialogProps) {
  const [lookingUp, setLookingUp] = useState(false);

  const lookupCost = async () => {
    const style = form.style_number?.trim();
    if (!style) {
      toast.error('Enter a style number first');
      return;
    }

    setLookingUp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not logged in');

      // Try local catalog first
      const { data: catalogHit } = await supabase
        .from('product_catalog')
        .select('piece_price, brand, description')
        .ilike('style_number', style)
        .order('piece_price', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (catalogHit?.piece_price) {
        updateField('unit_cost', catalogHit.piece_price);
        if (catalogHit.brand && !form.brand) updateField('brand', catalogHit.brand);
        if (catalogHit.description && !form.description) updateField('description', catalogHit.description);
        toast.success(`Found in catalog: $${catalogHit.piece_price.toFixed(2)}`);
        setLookingUp(false);
        return;
      }

      // Try SanMar API (prefer myPrice = wholesale, match size if specified)
      try {
        const sanmarRes = await supabase.functions.invoke('sanmar-api', {
          body: { action: 'getPricing', styleNumber: style },
        });
        if (sanmarRes.data?.success && sanmarRes.data.pricing?.length > 0) {
          const pricing = sanmarRes.data.pricing;
          const enteredSize = form.size?.trim().toUpperCase();
          
          // If a size is entered, try to match that size's price
          let matched: any[] = [];
          if (enteredSize) {
            matched = pricing.filter((p: any) => p.size?.toUpperCase() === enteredSize);
          }
          // Default to standard sizes (S/M/L/XL) — the base price tier
          if (matched.length === 0) {
            matched = pricing.filter((p: any) => ['S', 'M', 'L', 'XL'].includes(p.size?.toUpperCase()));
          }
          // Final fallback: all entries
          if (matched.length === 0) matched = pricing;
          
          // Use myPrice (wholesale), then salePrice, then casePrice
          const prices = matched
            .map((p: any) => p.myPrice || p.salePrice || p.casePrice || 0)
            .filter((p: number) => p > 0);
          
          if (prices.length > 0) {
            // Use the most common price (mode) for matched sizes, not max
            const price = prices[0];
            updateField('unit_cost', price);
            const sizeLabel = enteredSize || 'S-XL';
            toast.success(`SanMar wholesale (${sizeLabel}): $${price.toFixed(2)}`);
            setLookingUp(false);
            return;
          }
        }
      } catch (e) {
        console.log('SanMar lookup failed, trying S&S:', e);
      }

      // Try S&S Activewear API (customerPrice = wholesale, match size if specified)
      try {
        const ssRes = await supabase.functions.invoke('ss-activewear-api', {
          body: { action: 'getProducts', styleNumber: style },
        });
        if (ssRes.data?.success && ssRes.data.products?.length > 0) {
          const products = ssRes.data.products;
          const enteredSize = form.size?.trim().toUpperCase();
          
          // Match specific size if entered
          let matched = enteredSize
            ? products.filter((p: any) => (p.sizeName || p.size || '').toUpperCase() === enteredSize)
            : [];
          // Default to standard sizes
          if (matched.length === 0) {
            matched = products.filter((p: any) => ['S', 'M', 'L', 'XL'].includes((p.sizeName || p.size || '').toUpperCase()));
          }
          if (matched.length === 0) matched = products;
          
          const prices = matched
            .map((p: any) => parseFloat(p.customerPrice) || parseFloat(p.casePrice) || 0)
            .filter((p: number) => p > 0);
          
          if (prices.length > 0) {
            const price = prices[0];
            updateField('unit_cost', price);
            if (ssRes.data.styleInfo?.brandName && !form.brand) {
              updateField('brand', ssRes.data.styleInfo.brandName);
            }
            const sizeLabel = enteredSize || 'S-XL';
            toast.success(`S&S wholesale (${sizeLabel}): $${price.toFixed(2)}`);
            setLookingUp(false);
            return;
          }
        }
      } catch (e) {
        console.log('S&S lookup failed:', e);
      }

      toast.error('No pricing found for that style number');
    } catch (err: any) {
      toast.error(`Lookup failed: ${err.message}`);
    }
    setLookingUp(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Item' : 'Add Inventory Item'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Style Number *</Label>
              <Input value={form.style_number || ''} onChange={(e) => updateField('style_number', e.target.value)} placeholder="PC54" />
            </div>
            <div>
              <Label>Brand</Label>
              <ComboSelect
                value={form.brand || ''}
                onChange={(v) => updateField('brand', v)}
                options={distincts.brands}
                placeholder="Port & Company"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Color</Label>
              <ComboSelect
                value={form.color || ''}
                onChange={(v) => updateField('color', v)}
                options={distincts.colors}
                placeholder="Black"
              />
            </div>
            <div>
              <Label>Size</Label>
              <ComboSelect
                value={form.size || ''}
                onChange={(v) => updateField('size', v)}
                options={distincts.sizes}
                placeholder="XL"
              />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" value={form.quantity ?? 0} onChange={(e) => updateField('quantity', parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label>Unit Cost ($)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={form.unit_cost ?? 0}
                  onChange={(e) => updateField('unit_cost', parseFloat(e.target.value) || 0)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={lookupCost}
                  disabled={lookingUp || !form.style_number?.trim()}
                  className="shrink-0"
                >
                  {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="ml-1 hidden sm:inline">Lookup</span>
                </Button>
              </div>
            </div>
            <div>
              <Label>Bin</Label>
              <Input value={form.bin || ''} onChange={(e) => updateField('bin', e.target.value)} placeholder="B3" />
            </div>
          </div>
          <div>
            <Label>Location</Label>
            <ComboSelect
              value={form.location || ''}
              onChange={(v) => updateField('location', v)}
              options={distincts.locations}
              placeholder="Box 1: Construction"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description || ''} onChange={(e) => updateField('description', e.target.value)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes || ''} onChange={(e) => updateField('notes', e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={onSave} disabled={!form.style_number?.trim()}>
              {editingItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
