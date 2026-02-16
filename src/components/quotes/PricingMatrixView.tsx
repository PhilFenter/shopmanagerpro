import { usePricingMatrices, PricingMatrix } from '@/hooks/usePricingMatrices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function MatrixTable({ matrix }: { matrix: PricingMatrix }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-semibold">Qty</TableHead>
            {matrix.column_headers.map((h) => (
              <TableHead key={h} className="text-right">{h}</TableHead>
            ))}
            <TableHead className="text-right">Markup %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matrix.rows.map((row) => (
            <TableRow key={row.quantity}>
              <TableCell className="font-medium">{row.quantity.toLocaleString()}</TableCell>
              {row.prices.map((p, i) => (
                <TableCell key={i} className="text-right">${p.toFixed(2)}</TableCell>
              ))}
              <TableCell className="text-right">
                <Badge variant="secondary">{row.markup}%</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function PricingMatrixView() {
  const { matrices, isLoading } = usePricingMatrices();

  if (isLoading) {
    return <div className="flex items-center justify-center h-32">Loading pricing matrices...</div>;
  }

  if (!matrices.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No pricing matrices configured yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing Matrices</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={matrices[0]?.id}>
          <TabsList className="flex-wrap h-auto gap-1">
            {matrices.map((m) => (
              <TabsTrigger key={m.id} value={m.id} className="text-xs">
                {m.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {matrices.map((m) => (
            <TabsContent key={m.id} value={m.id}>
              <MatrixTable matrix={m} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
