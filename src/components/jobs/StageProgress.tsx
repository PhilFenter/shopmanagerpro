import { JobStage, STAGE_ORDER, STAGE_LABELS, STAGE_ICONS, FINAL_STAGES, getStageIndex, isFinalStage } from '@/hooks/useJobStages';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface StageProgressProps {
  currentStage: JobStage;
  compact?: boolean;
}

export function StageProgress({ currentStage, compact = false }: StageProgressProps) {
  const currentIndex = getStageIndex(currentStage);
  const isComplete = isFinalStage(currentStage);

  if (compact) {
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
          <div
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              isComplete ? "bg-green-500" : "bg-muted"
            )}
          />
        </div>
      </div>
    );
  }

  // Full version for detail view — horizontally scrollable
  return (
    <div className="space-y-3">
      <ScrollArea className="w-full">
        <div className="flex items-start gap-1 pb-2" style={{ minWidth: 'max-content' }}>
          {STAGE_ORDER.map((stage, index) => {
            const stageComplete = index < currentIndex || isComplete;
            const isCurrent = index === currentIndex && !isComplete;
            
            return (
              <div key={stage} className="flex flex-col items-center gap-1 w-20 flex-shrink-0">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all",
                    stageComplete && "bg-primary text-primary-foreground",
                    isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2",
                    !stageComplete && !isCurrent && "bg-muted text-muted-foreground"
                  )}
                >
                  {stageComplete ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    STAGE_ICONS[stage]
                  )}
                </div>
                <span 
                  className={cn(
                    "text-[10px] text-center leading-tight w-full",
                    isCurrent ? "font-semibold" : "text-muted-foreground"
                  )}
                >
                  {STAGE_LABELS[stage].split(' ').map((word, i) => (
                    <span key={i} className="block">{word}</span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      
      {/* Progress bar */}
      <div className="relative h-1 bg-muted rounded-full overflow-hidden">
        <div 
          className="absolute left-0 top-0 h-full bg-primary transition-all duration-300"
          style={{ width: `${isComplete ? 100 : (currentIndex / STAGE_ORDER.length) * 100}%` }}
        />
      </div>

      {/* Final stage indicator */}
      {isComplete && (
        <div className="flex items-center justify-center gap-2 p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <span className="text-lg">{STAGE_ICONS[currentStage]}</span>
          <span className="font-medium text-green-700 dark:text-green-300">
            {STAGE_LABELS[currentStage]}
          </span>
        </div>
      )}
    </div>
  );
}
