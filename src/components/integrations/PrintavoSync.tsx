import { useState } from 'react';
import { usePrintavoSync } from '@/hooks/usePrintavoSync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, ArrowDownToLine } from 'lucide-react';

export function PrintavoSync() {
  const { syncOrders, isSyncing, lastResult } = usePrintavoSync();
  const [limit, setLimit] = useState('25');

  const handleSync = () => {
    syncOrders(parseInt(limit, 10));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5" />
              Printavo Integration
            </CardTitle>
            <CardDescription>
              Import orders from Printavo to create jobs automatically
            </CardDescription>
          </div>
          <Badge variant="secondary">Connected</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Orders to fetch</label>
            <Select value={limit} onValueChange={setLimit}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">Last 10</SelectItem>
                <SelectItem value="25">Last 25</SelectItem>
                <SelectItem value="50">Last 50</SelectItem>
                <SelectItem value="100">Last 100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Now
              </>
            )}
          </Button>
        </div>

        {lastResult && (
          <div className={`flex items-center gap-3 rounded-lg p-4 ${
            lastResult.success 
              ? 'bg-green-500/10 border border-green-500/20' 
              : 'bg-destructive/10 border border-destructive/20'
          }`}>
            {lastResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            <div className="flex-1">
              {lastResult.success ? (
                <p className="text-sm">
                  <span className="font-medium">{lastResult.imported} orders imported</span>
                  {lastResult.skipped > 0 && (
                    <span className="text-muted-foreground"> • {lastResult.skipped} already existed</span>
                  )}
                  {lastResult.filtered > 0 && (
                    <span className="text-muted-foreground"> • {lastResult.filtered} not accepted/paid</span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-destructive">{lastResult.error}</p>
              )}
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-muted/50 p-4">
          <h4 className="font-medium mb-2">How it works</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Only imports orders that are <strong>accepted or paid</strong></li>
            <li>• Pulls customer name, email, phone, and order details</li>
            <li>• Skips orders that have already been imported</li>
            <li>• Jobs start at "Received" stage ready for production</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
