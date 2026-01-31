import { Button } from '@/components/ui/button';
import { JobStage, getNextStage, STAGE_LABELS, STAGE_ICONS, FINAL_STAGES, isAtFinalChoice, isFinalStage, useAdvanceStage } from '@/hooks/useJobStages';
import { ArrowRight, Loader2 } from 'lucide-react';

interface AdvanceStageButtonProps {
  jobId: string;
  currentStage: JobStage;
  size?: 'default' | 'sm' | 'lg';
}

export function AdvanceStageButton({ jobId, currentStage, size = 'default' }: AdvanceStageButtonProps) {
  const advanceStage = useAdvanceStage();
  const nextStage = getNextStage(currentStage);

  // Already at a final stage
  if (isFinalStage(currentStage)) {
    return (
      <Button variant="outline" size={size} disabled>
        ✓ Complete
      </Button>
    );
  }

  // At customer_notified - show two options: Picked Up or Shipped
  if (isAtFinalChoice(currentStage)) {
    return (
      <div className="flex gap-2">
        {FINAL_STAGES.map((finalStage) => (
          <Button
            key={finalStage}
            size={size}
            variant="default"
            onClick={() => advanceStage.mutate({ jobId, currentStage, targetStage: finalStage })}
            disabled={advanceStage.isPending}
            className="flex-1"
          >
            {advanceStage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span className="mr-1">{STAGE_ICONS[finalStage]}</span>
                {STAGE_LABELS[finalStage]}
              </>
            )}
          </Button>
        ))}
      </div>
    );
  }

  // Normal progression
  if (!nextStage) {
    return null;
  }

  return (
    <Button
      size={size}
      onClick={() => advanceStage.mutate({ jobId, currentStage })}
      disabled={advanceStage.isPending}
    >
      {advanceStage.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <>
          <span className="mr-2">{STAGE_ICONS[nextStage]}</span>
          <span className="hidden sm:inline">Move to </span>
          {STAGE_LABELS[nextStage]}
          <ArrowRight className="h-4 w-4 ml-2" />
        </>
      )}
    </Button>
  );
}
