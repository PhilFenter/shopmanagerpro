import { Button } from '@/components/ui/button';
import { JobStage, getNextStage, STAGE_LABELS, STAGE_ICONS, useAdvanceStage } from '@/hooks/useJobStages';
import { ArrowRight, Loader2 } from 'lucide-react';

interface AdvanceStageButtonProps {
  jobId: string;
  currentStage: JobStage;
  size?: 'default' | 'sm' | 'lg';
}

export function AdvanceStageButton({ jobId, currentStage, size = 'default' }: AdvanceStageButtonProps) {
  const advanceStage = useAdvanceStage();
  const nextStage = getNextStage(currentStage);

  if (!nextStage) {
    return (
      <Button variant="outline" size={size} disabled>
        ✓ Complete
      </Button>
    );
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
