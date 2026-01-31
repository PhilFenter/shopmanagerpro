import { JobStage, STAGE_ORDER, STAGE_LABELS, STAGE_ICONS, getStageIndex } from '@/hooks/useJobStages';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface StageProgressProps {
  currentStage: JobStage;
  compact?: boolean;
}

export function StageProgress({ currentStage, compact = false }: StageProgressProps) {
  const currentIndex = getStageIndex(currentStage);

  if (compact) {
    // Compact version for cards - just shows current stage with progress dots
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg">{STAGE_ICONS[currentStage]}</span>
        <span className="text-sm font-medium">{STAGE_LABELS[currentStage]}</span>
        <div className="flex gap-1 ml-auto">
          {STAGE_ORDER.map((stage, index) => (
            <div
              key={stage}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                index <= currentIndex 
                  ? "bg-primary" 
                  : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  // Full version for detail view
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {STAGE_ORDER.map((stage, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <div key={stage} className="flex flex-col items-center gap-1 flex-1">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all",
                  isComplete && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2",
                  !isComplete && !isCurrent && "bg-muted text-muted-foreground"
                )}
              >
                {isComplete ? (
                  <Check className="w-4 h-4" />
                ) : (
                  STAGE_ICONS[stage]
                )}
              </div>
              <span 
                className={cn(
                  "text-xs text-center hidden sm:block",
                  isCurrent ? "font-medium" : "text-muted-foreground"
                )}
              >
                {STAGE_LABELS[stage]}
              </span>
            </div>
          );
        })}
      </div>
      
      {/* Progress bar */}
      <div className="relative h-1 bg-muted rounded-full overflow-hidden">
        <div 
          className="absolute left-0 top-0 h-full bg-primary transition-all duration-300"
          style={{ width: `${(currentIndex / (STAGE_ORDER.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}
