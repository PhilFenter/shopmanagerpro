import { useJobRecipes } from '@/hooks/useJobRecipes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface JobRecipesListProps {
  jobId: string;
}

const TYPE_LABELS: Record<string, { label: string; route: string }> = {
  dtf: { label: 'DTF', route: '/dtf' },
  screen_print: { label: 'Screen Print', route: '/screen-print' },
  embroidery: { label: 'Embroidery', route: '/embroidery' },
  leather: { label: 'Leather', route: '/leather' },
};

export function JobRecipesList({ jobId }: JobRecipesListProps) {
  const { data: recipes, isLoading } = useJobRecipes(jobId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!recipes || recipes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">No production recipes linked</p>
        <p className="text-xs text-muted-foreground/70">
          Link recipes from DTF, Screen Print, Embroidery, or Leather pages
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recipes.map((recipe) => {
        const config = TYPE_LABELS[recipe.type];
        return (
          <div
            key={recipe.id}
            className="flex items-center justify-between rounded-lg border bg-muted/30 p-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Badge variant="outline" className="shrink-0">
                {config?.label || recipe.type}
              </Badge>
              <span className="font-medium truncate">{recipe.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => config && navigate(config.route)}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
