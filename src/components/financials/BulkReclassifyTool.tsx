import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SERVICE_LABELS } from '@/lib/constants';
import { Wand2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ServiceType = 'embroidery' | 'screen_print' | 'dtf' | 'leather_patch' | 'uv_patch' | 'heat_press_patch' | 'woven_patch' | 'pvc_patch' | 'mixed' | 'other';

interface ClassifiedJob {
  id: string;
  description: string | null;
  customer_name: string;
  sale_price: number | null;
  created_at: string;
  current_type: string;
  suggested_type: ServiceType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  selected: boolean;
  override?: ServiceType;
}

const CLASSIFICATION_RULES: { pattern: RegExp; type: ServiceType; confidence: 'high' | 'medium'; reason: string }[] = [
  { pattern: /\bembroid/i, type: 'embroidery', confidence: 'high', reason: 'Description mentions embroidery' },
  { pattern: /\bscreen\s*print/i, type: 'screen_print', confidence: 'high', reason: 'Description mentions screen printing' },
  { pattern: /\bdtf\b/i, type: 'dtf', confidence: 'high', reason: 'Description mentions DTF' },
  { pattern: /\bleather\s*patch/i, type: 'leather_patch', confidence: 'high', reason: 'Description mentions leather patch' },
  { pattern: /\bchestnut\b.*\bpatch\b|\bpatch\b.*\bchestnut\b/i, type: 'leather_patch', confidence: 'high', reason: 'Chestnut patch = leather patch' },
  { pattern: /\bfancy\b.*\bpatch\b|\bpatch\b.*\bfancy\b/i, type: 'leather_patch', confidence: 'high', reason: 'Fancy patch = leather patch' },
  { pattern: /\buv\s*patch/i, type: 'uv_patch', confidence: 'high', reason: 'Description mentions UV patch' },
  { pattern: /\bheat\s*press\s*patch/i, type: 'heat_press_patch', confidence: 'high', reason: 'Description mentions heat press patch' },
  { pattern: /\bwoven\s*patch/i, type: 'woven_patch', confidence: 'high', reason: 'Description mentions woven patch' },
  { pattern: /\bpvc\s*patch/i, type: 'pvc_patch', confidence: 'high', reason: 'Description mentions PVC patch' },
  { pattern: /\bprint\b.*\b(hoodie|shirt|tee|tank|jersey)/i, type: 'screen_print', confidence: 'medium', reason: 'Likely screen print (print + garment)' },
  { pattern: /\bsilk\s*screen/i, type: 'screen_print', confidence: 'high', reason: 'Silk screen = screen printing' },
  { pattern: /\b(side|center|front|back)\s*(leather\s*)?patch\b/i, type: 'leather_patch', confidence: 'medium', reason: 'Patch placement suggests leather patch' },
  { pattern: /\belk\s*patch\b|\bdeer\s*patch\b|\bantler\s*patch\b/i, type: 'leather_patch', confidence: 'high', reason: 'Animal patch = leather patch' },
  { pattern: /\bheat\s*transfer/i, type: 'dtf', confidence: 'medium', reason: 'Heat transfer likely DTF' },
];

function classifyJob(description: string | null): { type: ServiceType; confidence: 'high' | 'medium' | 'low'; reason: string } {
  if (!description || description.trim().length === 0) {
    return { type: 'other', confidence: 'low', reason: 'No description to analyze' };
  }

  // Strip HTML tags
  const cleanDesc = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(cleanDesc)) {
      return { type: rule.type, confidence: rule.confidence, reason: rule.reason };
    }
  }

  return { type: 'other', confidence: 'low', reason: 'No clear service type detected' };
}

export function BulkReclassifyTool() {
  const queryClient = useQueryClient();
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(0);
  const [selections, setSelections] = useState<Record<string, { selected: boolean; override?: ServiceType }>>({});
  const [filterConfidence, setFilterConfidence] = useState<string>('all');

  const { data: otherJobs = [], isLoading } = useQuery({
    queryKey: ['reclassify-other-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, description, customer_name, sale_price, created_at, service_type')
        .eq('service_type', 'other')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const classifiedJobs: ClassifiedJob[] = useMemo(() => {
    return otherJobs.map(j => {
      const { type, confidence, reason } = classifyJob(j.description);
      const sel = selections[j.id];
      return {
        id: j.id,
        description: j.description,
        customer_name: j.customer_name,
        sale_price: j.sale_price,
        created_at: j.created_at,
        current_type: j.service_type,
        suggested_type: type,
        confidence,
        reason,
        selected: sel?.selected ?? (confidence !== 'low' && type !== 'other'),
        override: sel?.override,
      };
    });
  }, [otherJobs, selections]);

  const reclassifiable = classifiedJobs.filter(j => j.suggested_type !== 'other' || j.override);
  const selectedJobs = classifiedJobs.filter(j => j.selected && (j.suggested_type !== 'other' || j.override));

  const filteredJobs = useMemo(() => {
    let jobs = classifiedJobs;
    if (filterConfidence === 'actionable') {
      jobs = jobs.filter(j => j.suggested_type !== 'other' || j.override);
    } else if (filterConfidence === 'high') {
      jobs = jobs.filter(j => j.confidence === 'high');
    } else if (filterConfidence === 'medium') {
      jobs = jobs.filter(j => j.confidence === 'medium');
    }
    return jobs;
  }, [classifiedJobs, filterConfidence]);

  const toggleSelect = (id: string) => {
    setSelections(prev => ({
      ...prev,
      [id]: { ...prev[id], selected: !(prev[id]?.selected ?? classifiedJobs.find(j => j.id === id)?.selected) },
    }));
  };

  const setOverride = (id: string, type: ServiceType) => {
    setSelections(prev => ({
      ...prev,
      [id]: { ...prev[id], selected: true, override: type },
    }));
  };

  const selectAll = () => {
    const updates: Record<string, { selected: boolean; override?: ServiceType }> = {};
    filteredJobs.forEach(j => {
      if (j.suggested_type !== 'other' || j.override) {
        updates[j.id] = { ...selections[j.id], selected: true };
      }
    });
    setSelections(prev => ({ ...prev, ...updates }));
  };

  const deselectAll = () => {
    const updates: Record<string, { selected: boolean; override?: ServiceType }> = {};
    filteredJobs.forEach(j => {
      updates[j.id] = { ...selections[j.id], selected: false };
    });
    setSelections(prev => ({ ...prev, ...updates }));
  };

  const handleApply = async () => {
    if (selectedJobs.length === 0) return;
    setApplying(true);
    setApplied(0);
    try {
      const batchSize = 50;
      for (let i = 0; i < selectedJobs.length; i += batchSize) {
        const batch = selectedJobs.slice(i, i + batchSize);
        const promises = batch.map(j => {
          const newType = j.override || j.suggested_type;
          return supabase
            .from('jobs')
            .update({ service_type: newType })
            .eq('id', j.id);
        });
        const results = await Promise.all(promises);
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
          console.error('Some updates failed:', errors);
        }
        setApplied(prev => prev + batch.length - errors.length);
      }
      toast.success(`Reclassified ${selectedJobs.length} jobs`);
      queryClient.invalidateQueries({ queryKey: ['reclassify-other-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['financials-period-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setSelections({});
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply changes');
    } finally {
      setApplying(false);
    }
  };

  const summaryByType = useMemo(() => {
    const map = new Map<string, number>();
    selectedJobs.forEach(j => {
      const type = j.override || j.suggested_type;
      map.set(type, (map.get(type) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [selectedJobs]);

  const confidenceCounts = useMemo(() => ({
    high: classifiedJobs.filter(j => j.confidence === 'high').length,
    medium: classifiedJobs.filter(j => j.confidence === 'medium').length,
    low: classifiedJobs.filter(j => j.confidence === 'low').length,
    actionable: reclassifiable.length,
  }), [classifiedJobs, reclassifiable]);

  const cleanDescription = (desc: string | null) => {
    if (!desc) return '—';
    return desc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) + (desc.length > 120 ? '…' : '');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Bulk Service Reclassification
            </CardTitle>
            <CardDescription>
              {otherJobs.length} jobs classified as "Other" — {reclassifiable.length} can be auto-reclassified based on description keywords
            </CardDescription>
          </div>
          {selectedJobs.length > 0 && (
            <Button onClick={handleApply} disabled={applying} className="shrink-0">
              {applying ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Applying {applied}/{selectedJobs.length}...</>
              ) : (
                <><CheckCircle className="mr-2 h-4 w-4" /> Apply {selectedJobs.length} Changes</>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Analyzing jobs...</p>
        ) : (
          <>
            {/* Summary */}
            {summaryByType.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground">Will reclassify:</span>
                {summaryByType.map(([type, count]) => (
                  <Badge key={type} variant="secondary">
                    {SERVICE_LABELS[type] || type}: {count}
                  </Badge>
                ))}
              </div>
            )}

            {/* Filter & Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterConfidence} onValueChange={setFilterConfidence}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({otherJobs.length})</SelectItem>
                  <SelectItem value="actionable">Actionable ({confidenceCounts.actionable})</SelectItem>
                  <SelectItem value="high">High confidence ({confidenceCounts.high})</SelectItem>
                  <SelectItem value="medium">Medium confidence ({confidenceCounts.medium})</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={selectAll}>Select All Visible</Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>Deselect All</Button>
            </div>

            {/* Table */}
            <div className="max-h-[500px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Suggested Type</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Override</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.slice(0, 200).map(j => (
                    <TableRow key={j.id} className={j.suggested_type === 'other' && !j.override ? 'opacity-50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={j.selected}
                          onCheckedChange={() => toggleSelect(j.id)}
                          disabled={j.suggested_type === 'other' && !j.override}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm max-w-[120px] truncate">{j.customer_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[250px]">
                        <span title={j.description || ''}>{cleanDescription(j.description)}</span>
                      </TableCell>
                      <TableCell>
                        {j.suggested_type !== 'other' ? (
                          <Badge variant="default" className="text-xs">
                            {SERVICE_LABELS[j.suggested_type] || j.suggested_type}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={j.confidence === 'high' ? 'default' : j.confidence === 'medium' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {j.confidence}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={j.override || ''}
                          onValueChange={(v) => setOverride(j.id, v as ServiceType)}
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue placeholder="Manual..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(SERVICE_LABELS).filter(([k]) => k !== 'other').map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredJobs.length > 200 && (
                <p className="text-center text-sm text-muted-foreground py-3">
                  Showing 200 of {filteredJobs.length}. Use filters to narrow.
                </p>
              )}
            </div>

            {reclassifiable.length === 0 && otherJobs.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span>None of the "Other" jobs had recognizable keywords. Use the Override column to manually assign service types.</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
