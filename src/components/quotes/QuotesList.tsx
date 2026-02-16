import { useState } from 'react';
import { useQuotes, Quote } from '@/hooks/useQuotes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, FileText, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { QuoteDetail } from './QuoteDetail';
import { NewQuoteDialog } from './NewQuoteDialog';
import { useAuth } from '@/hooks/useAuth';
import { hasFinancialAccess } from '@/hooks/useJobs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  declined: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  converted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export function QuotesList() {
  const { quotes, isLoading, deleteQuote } = useQuotes();
  const { role } = useAuth();
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="flex items-center justify-center h-32">Loading quotes...</div>;
  }

  if (selectedQuoteId) {
    return (
      <QuoteDetail
        quoteId={selectedQuoteId}
        onBack={() => setSelectedQuoteId(null)}
      />
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Quotes
          </CardTitle>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Quote
          </Button>
        </CardHeader>
        <CardContent>
          {!quotes.length ? (
            <p className="text-center text-muted-foreground py-8">
              No quotes yet. Create your first quote to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    {hasFinancialAccess(role) && <TableHead className="text-right">Total</TableHead>}
                    <TableHead>Date</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((q) => (
                    <TableRow
                      key={q.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedQuoteId(q.id)}
                    >
                      <TableCell className="font-medium">{q.quote_number}</TableCell>
                      <TableCell>{q.customer_name}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[q.status] || ''}>
                          {q.status}
                        </Badge>
                      </TableCell>
                      {hasFinancialAccess(role) && (
                        <TableCell className="text-right">
                          ${q.total_price?.toFixed(2) ?? '0.00'}
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground">
                        {format(new Date(q.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {(role === 'admin' || role === 'manager') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(q.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <NewQuoteDialog open={showNewDialog} onOpenChange={setShowNewDialog} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this quote and all its line items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteQuote.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
