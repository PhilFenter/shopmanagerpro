import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export type JobStage = 
  | 'received'
  | 'art_approved'
  | 'in_production'
  | 'production_complete'
  | 'qc_complete'
  | 'packaged'
  | 'customer_notified'
  | 'delivered';

export const STAGE_ORDER: JobStage[] = [
  'received',
  'art_approved',
  'in_production',
  'production_complete',
  'qc_complete',
  'packaged',
  'customer_notified',
  'delivered',
];

export const STAGE_LABELS: Record<JobStage, string> = {
  received: 'Received',
  art_approved: 'Art Approved',
  in_production: 'In Production',
  production_complete: 'Production Complete',
  qc_complete: 'QC Complete',
  packaged: 'Packaged',
  customer_notified: 'Customer Notified',
  delivered: 'Delivered',
};

export const STAGE_ICONS: Record<JobStage, string> = {
  received: '📥',
  art_approved: '🎨',
  in_production: '⚙️',
  production_complete: '✅',
  qc_complete: '🔍',
  packaged: '📦',
  customer_notified: '📧',
  delivered: '🚚',
};

export function getNextStage(currentStage: JobStage): JobStage | null {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  if (currentIndex === -1 || currentIndex === STAGE_ORDER.length - 1) {
    return null;
  }
  return STAGE_ORDER[currentIndex + 1];
}

export function getStageIndex(stage: JobStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function useAdvanceStage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      jobId, 
      currentStage, 
      notes 
    }: { 
      jobId: string; 
      currentStage: JobStage; 
      notes?: string;
    }) => {
      const nextStage = getNextStage(currentStage);
      if (!nextStage) {
        throw new Error('Job is already at final stage');
      }

      // Update job stage
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ 
          stage: nextStage,
          stage_updated_at: new Date().toISOString(),
          // Also update status for backwards compatibility
          status: nextStage === 'delivered' ? 'completed' : 
                  nextStage === 'in_production' ? 'in_progress' : 'pending',
        })
        .eq('id', jobId);

      if (updateError) throw updateError;

      // Log stage transition
      const { error: historyError } = await supabase
        .from('job_stage_history')
        .insert({
          job_id: jobId,
          from_stage: currentStage,
          to_stage: nextStage,
          changed_by: user?.id,
          notes,
        });

      if (historyError) throw historyError;

      return nextStage;
    },
    onSuccess: (nextStage) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({ 
        title: 'Stage updated',
        description: `Job moved to ${STAGE_LABELS[nextStage]}`,
      });
    },
    onError: (error) => {
      toast({ 
        variant: 'destructive',
        title: 'Failed to advance stage',
        description: error.message,
      });
    },
  });
}
