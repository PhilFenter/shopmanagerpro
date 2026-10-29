import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useProdAction } from '@/hooks/useProductionImports';

/** Admin-only reset for training: deletes the import and everything made from it. */
export function DeleteImportButton({ batchId, fileName, orderNumbers }: { batchId: string; fileName: string; orderNumbers: string[] }) {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const del = useProdAction<{ p_batch_id: string }, { orders: number }>(
    'prod_delete_import',
    (r) => `Import deleted (${r.orders} order${r.orders === 1 ? '' : 's'}). Drop the same files in again to start over.`,
  );
  if (role !== 'admin') return null;

  return (
    <>
      <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => { setTyped(''); setOpen(true); }}>
        <Trash2 className="mr-1 h-4 w-4" /> Delete this import
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {fileName}?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  This removes {orderNumbers.length} order{orderNumbers.length === 1 ? '' : 's'} ({orderNumbers.join(', ') || 'none'}) and
                  everything made from them: garments, labels, station check-offs, table spots and scans.
                </p>
                <p>
                  Labels already printed for these orders stop working. When you import the same PDF again, the orders come back as new and
                  need to be approved and labeled again.
                </p>
                <p>The original PDF and CSV files are kept. Nothing in InkSoft changes.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <div className="text-sm">Type <b>DELETE</b> to confirm.</div>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={typed.trim().toUpperCase() !== 'DELETE' || del.isPending}
              onClick={() => del.mutate({ p_batch_id: batchId }, { onSuccess: () => { setOpen(false); navigate('/production/imports'); } })}
            >
              {del.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Delete import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
