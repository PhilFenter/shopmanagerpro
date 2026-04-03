import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePOLineItems } from '@/hooks/usePurchaseOrders';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Briefcase, ArrowLeft } from 'lucide-react';

interface JobGarment {
  id: string;
  style: string | null;
  item_number: string | null;
  color: string | null;
  sizes: Record<string, number> | null;
  quantity: number;
  unit_cost: number | null;
  vendor: string | null;
}

interface Job {
  id: string;
  customer_name: string;
  order_number: string | null;
  invoice_number: string | null;
  description: string | null;
  stage: string;
}

export function JobImportDialog({ poId }: { poId: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedGarments, setSelectedGarments] = useState<Set<string>>(new Set());
  const { addItems } = usePOLineItems(poId);
  const { toast } = useToast();

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['po-jobs-search', search],
    queryFn: async () => {
      let q = supabase
        .from('jobs')
        .select('id, customer_name, order_number, invoice_number, description, stage')
        .order('created_at', { ascending: false })
        .limit(20);

      if (search.trim()) {
        q = q.or(`customer_name.ilike.%${search}%,order_number.ilike.%${search}%,invoice_number.ilike.%${search}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Job[];
    },
    enabled: open && !selectedJobId,
  });

  const { data: garments = [], isLoading: garmentsLoading } = useQuery({
    queryKey: ['po-job-garments', selectedJobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_garments')
        .select('id, style, item_number, color, sizes, quantity, unit_cost, vendor')
        .eq('job_id', selectedJobId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as JobGarment[];
    },
    enabled: !!selectedJobId,
  });

  const toggleGarment = (id: string) => {
    setSelectedGarments(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedGarments.size === garments.length) {
      setSelectedGarments(new Set());
    } else {
      setSelectedGarments(new Set(garments.map(g => g.id)));
    }
  };

  const handleImport = async () => {
    const toImport = garments.filter(g => selectedGarments.has(g.id));
    const lineItems: any[] = [];

    for (const g of toImport) {
      const sizes = g.sizes as Record<string, number> | null;
      if (sizes && Object.keys(sizes).length > 0) {
        for (const [sizeName, qty] of Object.entries(sizes)) {
          if (qty > 0) {
            lineItems.push({
              po_id: poId,
              style_number: g.style || g.item_number || 'UNKNOWN',
              color: g.color,
              size: sizeName,
              quantity: qty,
              unit_cost: g.unit_cost,
              total_cost: g.unit_cost ? g.unit_cost * qty : null,
              source: 'job',
              source_order_id: selectedJobId,
              source_order_name: null,
              brand: g.vendor,
              description: null,
              job_id: selectedJobId,
            });
          }
        }
      } else {
        lineItems.push({
          po_id: poId,
          style_number: g.style || g.item_number || 'UNKNOWN',
          color: g.color,
          size: null,
          quantity: g.quantity || 1,
          unit_cost: g.unit_cost,
          total_cost: g.unit_cost ? g.unit_cost * (g.quantity || 1) : null,
          source: 'job',
          source_order_id: selectedJobId,
          source_order_name: null,
          brand: g.vendor,
          description: null,
          job_id: selectedJobId,
        });
      }
    }

    if (lineItems.length > 0) {
      await addItems.mutateAsync(lineItems);
      toast({ title: `Imported ${lineItems.length} items from job` });
      setSelectedGarments(new Set());
      setSelectedJobId(null);
      setOpen(false);
    } else {
      toast({ title: 'No items to import' });
    }
  };

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      setSelectedJobId(null);
      setSelectedGarments(new Set());
      setSearch('');
    }
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Briefcase className="mr-2 h-4 w-4" /> Import from Jobs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedJobId ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => { setSelectedJobId(null); setSelectedGarments(new Set()); }}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                Garments — {selectedJob?.customer_name} ({selectedJob?.order_number || selectedJob?.invoice_number || 'No #'})
              </div>
            ) : 'Select a Job'}
          </DialogTitle>
        </DialogHeader>

        {!selectedJobId ? (
          <>
            <Input
              placeholder="Search by customer, order #, or invoice #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="mb-3"
            />
            {jobsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : jobs.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center">No jobs found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map(j => (
                    <TableRow key={j.id} className="cursor-pointer" onClick={() => setSelectedJobId(j.id)}>
                      <TableCell className="font-medium">{j.customer_name}</TableCell>
                      <TableCell>{j.order_number || j.invoice_number || '—'}</TableCell>
                      <TableCell><Badge variant="secondary">{j.stage}</Badge></TableCell>
                      <TableCell><Button size="sm" variant="ghost">Select</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        ) : (
          <>
            {garmentsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : garments.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center">No garments on this job.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedGarments.size === garments.length && garments.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Style</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {garments.map(g => {
                      const totalQty = g.sizes && Object.keys(g.sizes).length > 0
                        ? Object.values(g.sizes as Record<string, number>).reduce((s, v) => s + v, 0)
                        : g.quantity;
                      return (
                        <TableRow key={g.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedGarments.has(g.id)}
                              onCheckedChange={() => toggleGarment(g.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">{g.style || g.item_number || '—'}</TableCell>
                          <TableCell>{g.color || '—'}</TableCell>
                          <TableCell className="text-right">{totalQty}</TableCell>
                          <TableCell className="text-right">{g.unit_cost ? `$${g.unit_cost.toFixed(2)}` : '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <Button
                  className="mt-3 w-full"
                  onClick={handleImport}
                  disabled={selectedGarments.size === 0 || addItems.isPending}
                >
                  {addItems.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Import {selectedGarments.size} Garment{selectedGarments.size !== 1 ? 's' : ''} to PO
                </Button>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
