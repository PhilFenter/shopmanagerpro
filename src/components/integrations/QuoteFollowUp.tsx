import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, RefreshCw, CheckCircle, XCircle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FollowUpResult {
  quote_id: string;
  quote_number: string | null;
  email: string;
  status: string;
  tone?: string;
}

interface FollowUpResponse {
  success: boolean;
  dry_run: boolean;
  eligible: number;
  sent: number;
  skipped: number;
  results: FollowUpResult[];
}

export function QuoteFollowUp() {
  const [isRunning, setIsRunning] = useState(false);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [lastResponse, setLastResponse] = useState<FollowUpResponse | null>(null);
  const [delayDays, setDelayDays] = useState('3');

  const runFollowUp = async (dryRun: boolean) => {
    if (dryRun) setIsDryRunning(true);
    else setIsRunning(true);

    try {
      const { data, error } = await supabase.functions.invoke('quote-follow-up', {
        body: { dry_run: dryRun, delay_days: parseInt(delayDays, 10) },
      });

      if (error) throw error;
      setLastResponse(data as FollowUpResponse);

      if (dryRun) {
        toast.success(`Found ${data.eligible} eligible quote(s)`);
      } else {
        toast.success(`Sent ${data.sent} follow-up email(s)`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Follow-up failed');
    } finally {
      setIsRunning(false);
      setIsDryRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Quote Follow-Up
            </CardTitle>
            <CardDescription>
              Send follow-up emails to unconverted quotes older than {delayDays} day{delayDays !== '1' ? 's' : ''}
            </CardDescription>
          </div>
          <Badge variant="secondary">Automation</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <strong>Escalating 3-step sequence:</strong> Day 3 gentle nudge → Day 7 firmer reminder → Day 14 final notice.
            Clock starts when Printavo status = <strong>"Quote Approval Sent"</strong>.
            Targets <strong>sent</strong> quotes with a customer email and no converted job.
            Stops automatically when the customer <strong>approves or pays</strong> in Printavo.
          </div>
        </div>

        {/* Action buttons */}
        {/* Delay selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium whitespace-nowrap">Follow up after:</span>
          <Select value={delayDays} onValueChange={setDelayDays}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 5, 7, 10, 14].map(d => (
                <SelectItem key={d} value={String(d)}>{d} day{d !== 1 ? 's' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => runFollowUp(true)} disabled={isDryRunning || isRunning}>
            {isDryRunning ? (
              <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Previewing...</>
            ) : (
              'Dry Run (Preview)'
            )}
          </Button>
          <Button onClick={() => runFollowUp(false)} disabled={isRunning || isDryRunning}>
            {isRunning ? (
              <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
            ) : (
              'Send Follow-Ups'
            )}
          </Button>
        </div>

        {/* Results */}
        {lastResponse && (
          <>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="font-medium">Eligible: {lastResponse.eligible}</span>
              {!lastResponse.dry_run && (
                <>
                  <span className="text-green-600 font-medium">Sent: {lastResponse.sent}</span>
                  {lastResponse.skipped > 0 && (
                    <span className="text-destructive font-medium">Skipped: {lastResponse.skipped}</span>
                  )}
                </>
              )}
            </div>

            {lastResponse.results.length > 0 && (
              <div className="max-h-64 overflow-auto rounded-lg border">
                 <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote #</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lastResponse.results.map((r) => (
                      <TableRow key={r.quote_id}>
                        <TableCell className="font-medium">{r.quote_number || r.quote_id.slice(0, 8)}</TableCell>
                        <TableCell className="text-muted-foreground">{r.email}</TableCell>
                        <TableCell>
                          {r.tone && (
                            <Badge variant="outline" className="text-[10px] capitalize">{r.tone}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.status === 'sent' || r.status === 'eligible' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
