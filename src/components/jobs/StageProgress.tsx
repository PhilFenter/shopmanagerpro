import { JobStage, STAGE_ORDER, STAGE_LABELS, STAGE_ICONS, FINAL_STAGES, getStageIndex, isFinalStage } from '@/hooks/useJobStages';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StageProgressProps {
  currentStage: JobStage;
  compact?: boolean;
  onStageClick?: (stage: JobStage) => void;
}

export function StageProgress({ currentStage, compact = false, onStageClick }: StageProgressProps) {
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

  // Full version for detail view — horizontally scrollable with clickable icons
  return (
    <div className="space-y-3">
      <TooltipProvider delayDuration={200}>
        <ScrollArea className="w-full">
          <div className="flex items-start gap-1 pb-2" style={{ minWidth: 'max-content' }}>
            {STAGE_ORDER.map((stage, index) => {
              const stageComplete = index < currentIndex || isComplete;
              const isCurrent = index === currentIndex && !isComplete;
              const isClickable = !!onStageClick && stage !== currentStage && !isComplete;
              
              return (
                <Tooltip key={stage}>
                  <TooltipTrigger asChild>
                    <div 
                      className={cn(
                        "flex flex-col items-center gap-1 w-20 flex-shrink-0",
                        isClickable && "cursor-pointer group"
                      )}
                      onClick={() => isClickable && onStageClick(stage)}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all",
                          stageComplete && "bg-primary text-primary-foreground",
                          isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2",
                          !stageComplete && !isCurrent && "bg-muted text-muted-foreground",
                          isClickable && "hover:ring-2 hover:ring-primary/50 hover:ring-offset-1"
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
                          isCurrent ? "font-semibold" : "text-muted-foreground",
                          isClickable && "group-hover:text-foreground"
                        )}
                      >
                        {STAGE_LABELS[stage].split(' ').map((word, i) => (
                          <span key={i} className="block">{word}</span>
                        ))}
                      </span>
                    </div>
                  </TooltipTrigger>
                  {isClickable && (
                    <TooltipContent side="bottom" className="text-xs">
                      Move to {STAGE_LABELS[stage]}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}

            {/* Final stages: Picked Up / Shipped */}
            {!isComplete && onStageClick && (
              <>
                {FINAL_STAGES.map((stage) => (
                  <Tooltip key={stage}>
                    <TooltipTrigger asChild>
                      <div 
                        className="flex flex-col items-center gap-1 w-20 flex-shrink-0 cursor-pointer group"
                        onClick={() => onStageClick(stage)}
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all bg-muted text-muted-foreground hover:ring-2 hover:ring-primary/50 hover:ring-offset-1">
                          {STAGE_ICONS[stage]}
                        </div>
                        <span className="text-[10px] text-center leading-tight w-full text-muted-foreground group-hover:text-foreground">
                          {STAGE_LABELS[stage].split(' ').map((word, i) => (
                            <span key={i} className="block">{word}</span>
                          ))}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      Move to {STAGE_LABELS[stage]}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </>
            )}

            {/* Show final stage as completed if applicable */}
            {isComplete && (
              <div className="flex flex-col items-center gap-1 w-20 flex-shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-green-500 text-white ring-2 ring-green-500 ring-offset-2">
                  <Check className="w-4 h-4" />
                </div>
                <span className="text-[10px] text-center leading-tight w-full font-semibold text-green-600 dark:text-green-400">
                  {STAGE_LABELS[currentStage].split(' ').map((word, i) => (
                    <span key={i} className="block">{word}</span>
                  ))}
                </span>
              </div>
            )}
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
      </TooltipProvider>
    </div>
  );
}
