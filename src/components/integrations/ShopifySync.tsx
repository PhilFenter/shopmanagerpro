import { useState } from 'react';
import { format } from 'date-fns';
import { useShopifySync } from '@/hooks/useShopifySync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RefreshCw, CheckCircle, XCircle, ShoppingBag, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ShopifySync() {
  const { syncOrders, isSyncing, lastResult } = useShopifySync();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [minOrderNumber, setMinOrderNumber] = useState('');

  const handleSync = () => {
    syncOrders({
      startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
      endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
      minOrderNumber: minOrderNumber || undefined,
    });
  };

  const handleQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start);
    setEndDate(end);
  };

  const handleYearToDate = () => {
    const end = new Date();
    const start = new Date(end.getFullYear(), 0, 1);
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Shopify Integration
            </CardTitle>
            <CardDescription>
              Import orders from your Shopify store to track production
            </CardDescription>
          </div>
          <Badge variant="secondary">Connected</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick range buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handleQuickRange(30)}>
            Last 30 days
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleQuickRange(90)}>
            Last 90 days
          </Button>
          <Button variant="outline" size="sm" onClick={handleYearToDate}>
            Year to date
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setStartDate(undefined); setEndDate(undefined); }}>
            All time
          </Button>
        </div>

        {/* Date range pickers */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-40 justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "MMM d, yyyy") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">End date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-40 justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "MMM d, yyyy") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Min order #</label>
            <Input
              type="text"
              placeholder="e.g. 1001"
              value={minOrderNumber}
              onChange={(e) => setMinOrderNumber(e.target.value)}
              className="w-28"
            />
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

        {/* Results display */}
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
                  {lastResult.pages && lastResult.pages > 1 && (
                    <span className="text-muted-foreground"> • {lastResult.pages} pages fetched</span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-destructive">{lastResult.error}</p>
              )}
            </div>
          </div>
        )}

        {/* Info section */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <h4 className="font-medium mb-2">How it works</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Imports orders from your Shopify store</li>
            <li>• Use date range to import historical orders in bulk</li>
            <li>• Customer name, email, and phone are imported</li>
            <li>• Skips orders that have already been imported</li>
            <li>• Orders appear in Jobs for time tracking and production</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
