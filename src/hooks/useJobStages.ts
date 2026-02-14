import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export type JobStage = 
  | 'received'
  | 'art_approved'
  | 'product_ordered'
  | 'product_arrived'
  | 'product_staged'
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
  'product_ordered',
  'product_arrived',
  'product_staged',
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
  product_ordered: 'Product Ordered',
  product_arrived: 'Product Arrived',
  product_staged: 'Product Staged',
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
  product_ordered: '🛒',
  product_arrived: '📬',
  product_staged: '📋',
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
      notes,
      // Job metadata for notifications
      source,
      customerName,
      customerEmail,
      orderNumber,
    }: { 
      jobId: string; 
      currentStage: JobStage; 
      targetStage?: JobStage;
      notes?: string;
      source?: string | null;
      customerName?: string;
      customerEmail?: string | null;
      orderNumber?: string | null;
    }) => {
      // Determine next stage
      let nextStage: JobStage;
      
      if (targetStage) {
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

      // Fire customer notification (non-blocking)
      if ((source === 'shopify' || source === 'printavo') && customerEmail) {
        supabase.functions.invoke('notify-customer', {
          body: {
            jobId,
            customerName: customerName || 'Customer',
            customerEmail,
            orderNumber: orderNumber || 'N/A',
            stage: nextStage,
            source,
          },
        }).then(({ error }) => {
          if (error) console.error('Notification error:', error);
          else console.log(`Notification sent for stage: ${nextStage}`);
        });
      }

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
