import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { hasFinancialAccess } from '@/hooks/useJobs';
import { usePurchaseOrders, usePOLineItems, useInkSoftOrders } from '@/hooks/usePurchaseOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [importing, setImporting] = useState<number | null>(null);
  const { fetchOrders, fetchOrderDetail } = useInkSoftOrders();
  const { addItems } = usePOLineItems(poId);
  const { toast } = useToast();

  const loadOrders = async () => {
    setLoading(true);
    try {
      const result = await fetchOrders();
      setOrders(result.orders || []);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to fetch InkSoft orders', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const importOrder = async (orderId: number, orderName: string) => {
    setImporting(orderId);
    try {
      const result = await fetchOrderDetail(orderId);
      const order = result.order;
      const lineItems: any[] = [];
      for (const item of order.items || []) {
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
          });
        }
      }
      if (lineItems.length > 0) {
        await addItems.mutateAsync(lineItems);
        toast({ title: `Imported ${lineItems.length} items from order ${orderName}` });
        onImported();
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
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={loadOrders}>
          <Import className="mr-2 h-4 w-4" /> Import from InkSoft
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>InkSoft Orders</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <p className="text-muted-foreground py-4">No pending orders found.</p>
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
                <TableRow key={o.OrderId}>
                  <TableCell className="font-medium">{o.ProposalReferenceId || o.OrderId}</TableCell>
                  <TableCell>{o.Name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{o.ProductionStatus || 'Pending'}</Badge>
                  </TableCell>
                  <TableCell>${(o.TotalAmount || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => importOrder(o.OrderId, o.ProposalReferenceId || String(o.OrderId))}
                      disabled={importing === o.OrderId}
                    >
                      {importing === o.OrderId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Import'}
                    </Button>
                  </TableCell>
                </TableRow>
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
