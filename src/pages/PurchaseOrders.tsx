import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { hasFinancialAccess } from '@/hooks/useJobs';
import { usePurchaseOrders, usePOLineItems, useInkSoftOrders, INKSOFT_STORES, type InkSoftStoreKey } from '@/hooks/usePurchaseOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Package, Plus, Trash2, Download, ShoppingCart, Truck, Loader2, FileText, Import,
} from 'lucide-react';
import { JobImportDialog } from '@/components/purchase-orders/JobImportDialog';
import { format } from 'date-fns';

function ShippingTracker({ progress, remaining, threshold }: { progress: number; remaining: number; threshold: number }) {
  const isFree = remaining <= 0;
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 mb-2">
          <Truck className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">
            {isFree ? '🎉 Free shipping unlocked!' : `$${remaining.toFixed(2)} away from free shipping`}
          </span>
        </div>
        <Progress value={progress} className="h-3" />
        <p className="text-xs text-muted-foreground mt-1">
          SanMar free freight threshold: ${threshold}
        </p>
      </CardContent>
    </Card>
  );
}

function InkSoftImportDialog({ poId, onImported }: { poId: string; onImported: () => void }) {
  const [orderIdInput, setOrderIdInput] = useState('');
  const [importing, setImporting] = useState<number | null>(null);
  const [store, setStore] = useState<InkSoftStoreKey>('hcd_kiosk');
  const [open, setOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { fetchOrderDetail } = useInkSoftOrders();
  const { addItems } = usePOLineItems(poId);
  const { toast } = useToast();

  const handleStoreChange = (val: string) => {
    setStore(val as InkSoftStoreKey);
    setPreviewData(null);
  };

  const previewOrder = async () => {
    const id = parseInt(orderIdInput.trim(), 10);
    if (!id || isNaN(id)) {
      toast({ variant: 'destructive', title: 'Enter a valid InkSoft Order ID' });
      return;
    }
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const result = await fetchOrderDetail(id, store);
      setPreviewData(result.order);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to load order', description: err.message });
    } finally {
      setPreviewLoading(false);
    }
  };

  const importOrder = async (orderId: number, orderName: string) => {
    setImporting(orderId);
    try {
      const result = previewData && previewOrderId === orderId
        ? { order: previewData }
        : await fetchOrderDetail(orderId, store);
      const order = result.order;
      const lineItems: any[] = [];
      const decorationSummary = (item: any) => {
        if (!item.decorations || item.decorations.length === 0) return null;
        return item.decorations
          .map((d: any) => `${d.name}${d.placement ? ` @ ${d.placement}` : ''}`)
          .join(' | ');
      };
      for (const item of order.items || []) {
        const decoNote = decorationSummary(item);
        const baseDescription = [item.productName, decoNote].filter(Boolean).join(' — ');
        if (item.sizes && item.sizes.length > 0) {
          for (const sz of item.sizes) {
            if (sz.Quantity > 0) {
              lineItems.push({
                po_id: poId,
                style_number: item.styleName || item.productName || 'UNKNOWN',
                color: item.colorName,
                size: sz.SizeName,
                quantity: sz.Quantity,
                unit_cost: null,
                total_cost: null,
                source: 'inksoft',
                source_order_id: String(orderId),
                source_order_name: orderName,
                description: baseDescription || null,
              });
            }
          }
        } else {
          lineItems.push({
            po_id: poId,
            style_number: item.styleName || item.productName || 'UNKNOWN',
            color: item.colorName,
            quantity: item.quantity || 1,
            unit_cost: null,
            total_cost: null,
            source: 'inksoft',
            source_order_id: String(orderId),
            source_order_name: orderName,
            description: baseDescription || null,
          });
        }
      }
      if (lineItems.length > 0) {
        await addItems.mutateAsync(lineItems);
        toast({ title: `Imported ${lineItems.length} items from order ${orderName}` });
        onImported();
        setOpen(false);
      } else {
        toast({ title: 'No garment items found in this order' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Import failed', description: err.message });
    } finally {
      setImporting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) loadOrders(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Import className="mr-2 h-4 w-4" /> Import from InkSoft
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>InkSoft Orders</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-muted-foreground">Store:</span>
          <Select value={store} onValueChange={handleStoreChange}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INKSOFT_STORES.map(s => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <p className="text-muted-foreground py-4">No pending orders found in this store.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o: any) => (
                <>
                  <TableRow key={o.OrderId}>
                    <TableCell className="font-medium">{o.ProposalReferenceId || o.OrderId}</TableCell>
                    <TableCell>{o.Name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{o.ProductionStatus || 'Pending'}</Badge>
                    </TableCell>
                    <TableCell>${(o.TotalAmount || 0).toFixed(2)}</TableCell>
                    <TableCell className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => previewOrderId === o.OrderId ? setPreviewOrderId(null) : previewOrder(o.OrderId)}
                      >
                        {previewOrderId === o.OrderId ? 'Hide' : 'Preview'}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => importOrder(o.OrderId, o.ProposalReferenceId || String(o.OrderId))}
                        disabled={importing === o.OrderId}
                      >
                        {importing === o.OrderId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Import to PO'}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {previewOrderId === o.OrderId && (
                    <TableRow key={`${o.OrderId}-preview`}>
                      <TableCell colSpan={5} className="bg-muted/30">
                        {previewLoading ? (
                          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                        ) : !previewData ? (
                          <p className="text-sm text-muted-foreground py-2">No data.</p>
                        ) : (
                          <div className="space-y-3 py-2">
                            {(previewData.items || []).map((it: any, idx: number) => {
                              const sizeBreakdown = (it.sizes || [])
                                .filter((s: any) => s.Quantity > 0)
                                .map((s: any) => `${s.SizeName}×${s.Quantity}`)
                                .join(', ');
                              return (
                                <div key={idx} className="border-l-2 border-primary pl-3">
                                  <p className="font-medium text-sm">
                                    {it.styleName || it.productName} {it.colorName ? `— ${it.colorName}` : ''}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {sizeBreakdown || `Qty ${it.quantity}`}
                                  </p>
                                  {it.decorations && it.decorations.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {it.decorations.map((d: any, di: number) => (
                                        <Badge key={di} variant="outline" className="text-xs">
                                          {d.name}{d.placement ? ` · ${d.placement}` : ''}{d.method ? ` · ${d.method}` : ''}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddManualItemDialog({ poId }: { poId: string }) {
  const [style, setStyle] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState('1');
  const [cost, setCost] = useState('');
  const [open, setOpen] = useState(false);
  const { addItems } = usePOLineItems(poId);

  const handleAdd = async () => {
    await addItems.mutateAsync([{
      po_id: poId,
      style_number: style.toUpperCase().trim(),
      color: color || null,
      size: size || null,
      quantity: parseInt(qty) || 1,
      unit_cost: cost ? parseFloat(cost) : null,
      total_cost: cost ? parseFloat(cost) * (parseInt(qty) || 1) : null,
      source: 'manual',
      source_order_id: null,
      source_order_name: null,
      brand: null,
      description: null,
      job_id: null,
    }]);
    setStyle(''); setColor(''); setSize(''); setQty('1'); setCost('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Line Item</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Input placeholder="Style Number (e.g. PC54)" value={style} onChange={e => setStyle(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Color" value={color} onChange={e => setColor(e.target.value)} />
            <Input placeholder="Size" value={size} onChange={e => setSize(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Qty" type="number" value={qty} onChange={e => setQty(e.target.value)} />
            <Input placeholder="Unit Cost" type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} />
          </div>
          <Button onClick={handleAdd} disabled={!style || addItems.isPending}>
            {addItems.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add to PO
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PODetail({ po }: { po: any }) {
  const { items, isLoading, removeItem, totalQty, totalCost, shippingProgress, remainingForFreeShipping, FREE_SHIPPING_THRESHOLD } = usePOLineItems(po.id);

  return (
    <div className="space-y-4">
      <ShippingTracker progress={shippingProgress} remaining={remainingForFreeShipping} threshold={FREE_SHIPPING_THRESHOLD} />

      <div className="flex flex-wrap gap-2">
        <InkSoftImportDialog poId={po.id} onImported={() => {}} />
        <JobImportDialog poId={po.id} />
        <AddManualItemDialog poId={po.id} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Line Items ({totalQty} pcs)</CardTitle>
            <span className="font-semibold text-primary">${totalCost.toFixed(2)}</span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No items yet. Import from InkSoft or add items manually.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Style</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.style_number}</TableCell>
                    <TableCell>{item.color || '—'}</TableCell>
                    <TableCell>{item.size || '—'}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{item.unit_cost ? `$${item.unit_cost.toFixed(2)}` : '—'}</TableCell>
                    <TableCell className="text-right">{item.total_cost ? `$${item.total_cost.toFixed(2)}` : '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.source || 'manual'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeItem.mutate(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PurchaseOrders() {
  const { role, loading: authLoading } = useAuth();
  const { orders, isLoading, createPO, deletePO } = usePurchaseOrders();
  const [selectedPO, setSelectedPO] = useState<string | null>(null);

  if (authLoading) return <div className="flex items-center justify-center h-64">Loading...</div>;
  if (!hasFinancialAccess(role)) return <Navigate to="/dashboard" replace />;

  const activePO = orders.find(po => po.id === selectedPO);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" />
            Purchase Orders
          </h1>
          <p className="text-muted-foreground">
            Stage garments from InkSoft &amp; jobs, then generate SanMar POs
          </p>
        </div>
        <Button onClick={() => createPO.mutate('sanmar')} disabled={createPO.isPending}>
          <Plus className="mr-2 h-4 w-4" />
          New PO
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* PO List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase">Drafts & History</h2>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No purchase orders yet</p>
              </CardContent>
            </Card>
          ) : (
            orders.map(po => (
              <Card
                key={po.id}
                className={`cursor-pointer transition-colors hover:border-primary ${selectedPO === po.id ? 'border-primary bg-accent/30' : ''}`}
                onClick={() => setSelectedPO(po.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{po.po_number || 'Draft PO'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(po.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={po.status === 'submitted' ? 'default' : 'secondary'}>
                        {po.status}
                      </Badge>
                      {po.status === 'draft' && (
                        <Button
                          variant="ghost" size="icon"
                          onClick={e => { e.stopPropagation(); deletePO.mutate(po.id); }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* PO Detail */}
        <div className="lg:col-span-2">
          {activePO ? (
            <PODetail po={activePO} />
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Select a PO or create a new one to get started</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
