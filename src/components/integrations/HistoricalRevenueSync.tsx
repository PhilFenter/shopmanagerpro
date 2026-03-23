import { useHistoricalCustomerSync } from '@/hooks/useHistoricalCustomerSync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, Database } from 'lucide-react';

export function HistoricalRevenueSync() {
  const { runSync, isSyncing, lastResult } = useHistoricalCustomerSync();

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Historical Customer Revenue
            </CardTitle>
            <CardDescription>
              Scrape full order history from Shopify &amp; Printavo to compute accurate lifetime customer revenue
            </CardDescription>
          </div>
          <Badge variant="outline">One-time</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => runSync(['shopify', 'printavo'])} disabled={isSyncing}>
            {isSyncing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Scraping all history...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Both (Full History)
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => runSync(['shopify'])} disabled={isSyncing}>
            Shopify Only
          </Button>
          <Button variant="outline" onClick={() => runSync(['printavo'])} disabled={isSyncing}>
            Printavo Only
          </Button>
        </div>

        {lastResult && (
          <div className={`flex items-start gap-3 rounded-lg p-4 ${
            lastResult.success
              ? 'bg-green-500/10 border border-green-500/20'
              : 'bg-destructive/10 border border-destructive/20'
          }`}>
            {lastResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive mt-0.5" />
            )}
            <div className="flex-1 text-sm space-y-1">
              {lastResult.success ? (
                <>
                  <p className="font-medium">{lastResult.uniqueCustomers} unique customers found</p>
                  <p className="text-muted-foreground">
                    Shopify: {lastResult.shopify.orders} orders · ${lastResult.shopify.revenue.toLocaleString()}
                  </p>
                  <p className="text-muted-foreground">
                    Printavo: {lastResult.printavo.orders} invoices · ${lastResult.printavo.revenue.toLocaleString()}
                  </p>
                  <p className="text-muted-foreground">
                    {lastResult.updated} updated · {lastResult.created} new · {lastResult.skipped} unchanged
                  </p>
                </>
              ) : (
                <p className="text-destructive">{lastResult.error}</p>
              )}
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-muted/50 p-4">
          <h4 className="font-medium mb-2">How it works</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Scrapes ALL orders from Shopify &amp; Printavo (no date limit)</li>
            <li>• Computes lifetime revenue per customer name</li>
            <li>• Uses floor logic — existing totals are never reduced</li>
            <li>• Does NOT import old jobs into your production pipeline</li>
            <li>• Only creates new customer records for $50+ revenue</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
