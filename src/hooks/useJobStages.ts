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
  | 'picked_up'
  | 'shipped';

// Main progression order (up to customer_notified, then branches)
export const STAGE_ORDER: JobStage[] = [
  'received',
  'art_approved',
  'in_production',
  'production_complete',
  'qc_complete',
  'packaged',
  'customer_notified',
];

// Final stages (after customer_notified, pick one)
export const FINAL_STAGES: JobStage[] = ['picked_up', 'shipped'];

export const STAGE_LABELS: Record<JobStage, string> = {
  received: 'Received',
  art_approved: 'Art Approved',
  in_production: 'In Production',
  production_complete: 'Production Complete',
  qc_complete: 'QC Complete',
  packaged: 'Packaged',
  customer_notified: 'Customer Notified',
  picked_up: 'Picked Up',
  shipped: 'Shipped',
};

export const STAGE_ICONS: Record<JobStage, string> = {
  received: '📥',
  art_approved: '🎨',
  in_production: '⚙️',
  production_complete: '✅',
  qc_complete: '🔍',
  packaged: '📦',
  customer_notified: '📧',
  picked_up: '🏪',
  shipped: '🚚',
};

export function getNextStage(currentStage: JobStage): JobStage | null {
  // If at final stage, no next
  if (FINAL_STAGES.includes(currentStage)) {
    return null;
  }
  
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  if (currentIndex === -1) {
    return null;
  }
  
  // If at last main stage (customer_notified), next stage is chosen by user
  if (currentIndex === STAGE_ORDER.length - 1) {
    return null; // User picks between picked_up and shipped
  }
  
  return STAGE_ORDER[currentIndex + 1];
}

export function isAtFinalChoice(stage: JobStage): boolean {
  return stage === 'customer_notified';
}

export function isFinalStage(stage: JobStage): boolean {
  return FINAL_STAGES.includes(stage);
}

export function getStageIndex(stage: JobStage): number {
  if (FINAL_STAGES.includes(stage)) {
    return STAGE_ORDER.length; // Final stages are after the main progression
  }
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
      targetStage,
      notes 
    }: { 
      jobId: string; 
      currentStage: JobStage; 
      targetStage?: JobStage; // For choosing between picked_up/shipped
      notes?: string;
    }) => {
      // Determine next stage - use targetStage if provided, otherwise calculate
      let nextStage: JobStage;
      
      if (targetStage) {
        // Validate targetStage is valid for current position
        if (isAtFinalChoice(currentStage) && FINAL_STAGES.includes(targetStage)) {
          nextStage = targetStage;
        } else {
          throw new Error('Invalid target stage');
        }
      } else {
        const calculatedNext = getNextStage(currentStage);
        if (!calculatedNext) {
          throw new Error('Job is already at final stage');
        }
        nextStage = calculatedNext;
      }

      // Update job stage
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ 
          stage: nextStage,
          stage_updated_at: new Date().toISOString(),
          // Also update status for backwards compatibility
          status: isFinalStage(nextStage) ? 'completed' : 
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
