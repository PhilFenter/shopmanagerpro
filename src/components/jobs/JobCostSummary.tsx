import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useJobLineItems } from '@/hooks/useJobLineItems';
import { Job } from '@/hooks/useJobs';
import { DollarSign, TrendingUp, TrendingDown, Clock, Package } from 'lucide-react';
import { formatTime } from './TimeEntry';

// 16.5% payroll tax burden as per business logic
const PAYROLL_TAX_BURDEN = 0.165;

interface JobCostSummaryProps {
  job: Job;
}

export function JobCostSummary({ job }: JobCostSummaryProps) {
  const { timeEntries, totalMinutes } = useTimeEntries(job.id);
  const { lineItems } = useJobLineItems(job.id);

  // Calculate labor cost from time entries with worker wage rates
  const laborCost = timeEntries.reduce((sum, entry) => {
    const hourlyRate = entry.worker?.hourly_rate || 0;
    const hours = (entry.duration || 0) / 60;
    return sum + (hours * hourlyRate);
  }, 0);

  // Add payroll tax burden (16.5%)
  const laborWithBurden = laborCost * (1 + PAYROLL_TAX_BURDEN);

  // Material costs from line items or job level
  const materialCost = lineItems.length > 0
    ? lineItems.reduce((sum, item) => sum + Number(item.material_cost || 0), 0)
    : Number(job.material_cost || 0);

  // Total revenue from line items or job level
  const revenue = lineItems.length > 0
    ? lineItems.reduce((sum, item) => sum + Number(item.sale_price || 0), 0)
    : Number(job.sale_price || 0);

  // Total cost and profit
  const totalCost = laborWithBurden + materialCost;
  const profit = revenue - totalCost;
  const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const isPositive = profit >= 0;

  return (
    <div className="space-y-4 p-4 rounded-lg bg-muted/50">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <DollarSign className="h-4 w-4" />
        Job Cost Summary
      </h4>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {/* Time */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Time:</span>
          <span className="font-mono">{formatTime(totalMinutes)}</span>
        </div>

        {/* Quantity */}
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Qty:</span>
          <span className="font-mono">{job.quantity}</span>
        </div>
      </div>

      <div className="border-t pt-3 space-y-2">
        <CostRow label="Revenue" value={revenue} isRevenue />
        <CostRow label="Labor" value={laborCost} />
        <CostRow label="+ Tax Burden (16.5%)" value={laborWithBurden - laborCost} isSubitem />
        <CostRow label="Materials" value={materialCost} />
        
        <div className="border-t pt-2 mt-2">
          <div className="flex items-center justify-between font-medium">
            <div className="flex items-center gap-1">
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              <span>Profit</span>
            </div>
            <span className={isPositive ? 'text-green-600' : 'text-destructive'}>
              ${profit.toFixed(2)} ({profitMargin.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CostRow({ 
  label, 
  value, 
  isRevenue = false,
  isSubitem = false 
}: { 
  label: string; 
  value: number; 
  isRevenue?: boolean;
  isSubitem?: boolean;
}) {
  return (
    <div className={`flex justify-between text-sm ${isSubitem ? 'pl-4 text-muted-foreground' : ''}`}>
      <span className={isRevenue ? 'font-medium' : ''}>{label}</span>
      <span className={`font-mono ${isRevenue ? 'text-primary font-medium' : 'text-foreground'}`}>
        ${value.toFixed(2)}
      </span>
    </div>
  );
}
