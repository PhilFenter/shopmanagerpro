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

      // Try SanMar API
      try {
        const sanmarRes = await supabase.functions.invoke('sanmar-api', {
          body: { action: 'getPricing', styleNumber: style },
        });
        if (sanmarRes.data?.success && sanmarRes.data.pricing?.length > 0) {
          const maxPrice = Math.max(...sanmarRes.data.pricing.map((p: any) => p.piecePrice || 0));
          if (maxPrice > 0) {
            updateField('unit_cost', maxPrice);
            toast.success(`SanMar price: $${maxPrice.toFixed(2)}`);
            setLookingUp(false);
            return;
          }
        }
      } catch (e) {
        console.log('SanMar lookup failed, trying S&S:', e);
      }

      // Try S&S Activewear API
      try {
        const ssRes = await supabase.functions.invoke('ss-activewear-api', {
          body: { action: 'getProducts', styleNumber: style },
        });
        if (ssRes.data?.success && ssRes.data.products?.length > 0) {
          const prices = ssRes.data.products
            .map((p: any) => parseFloat(p.customerPrice) || parseFloat(p.piecePrice) || 0)
            .filter((p: number) => p > 0);
          if (prices.length > 0) {
            const maxPrice = Math.max(...prices);
            updateField('unit_cost', maxPrice);
            if (ssRes.data.styleInfo?.brandName && !form.brand) {
              updateField('brand', ssRes.data.styleInfo.brandName);
            }
            toast.success(`S&S price: $${maxPrice.toFixed(2)}`);
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
