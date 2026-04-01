import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Settings2 } from 'lucide-react';

export const SIZE_GROUPS = {
  'Infant': ['NB', '6M', '12M', '18M', '24M'],
  'Toddler': ['2T', '3T', '4T', '5T'],
  'Youth': ['YXS', 'YS', 'YM', 'YL', 'YXL'],
  'Adult': ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'],
  'Tall': ['LT', 'XLT', '2XLT', '3XLT'],
  'One Size': ['OSFA'],
};

export const ALL_SIZES = Object.values(SIZE_GROUPS).flat();

export const DEFAULT_VISIBLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

interface SizeColumnManagerProps {
  visibleSizes: string[];
  onVisibleSizesChange: (sizes: string[]) => void;
}

export function SizeColumnManager({ visibleSizes, onVisibleSizesChange }: SizeColumnManagerProps) {
  const [open, setOpen] = useState(false);

  const toggleSize = (size: string) => {
    if (visibleSizes.includes(size)) {
      onVisibleSizesChange(visibleSizes.filter(s => s !== size));
    } else {
      // Insert in master order
      const newSizes = ALL_SIZES.filter(s => visibleSizes.includes(s) || s === size);
      onVisibleSizesChange(newSizes);
    }
  };

  const toggleGroup = (group: string) => {
    const groupSizes = SIZE_GROUPS[group as keyof typeof SIZE_GROUPS];
    const allSelected = groupSizes.every(s => visibleSizes.includes(s));
    if (allSelected) {
      onVisibleSizesChange(visibleSizes.filter(s => !groupSizes.includes(s)));
    } else {
      const combined = [...new Set([...visibleSizes, ...groupSizes])];
      onVisibleSizesChange(ALL_SIZES.filter(s => combined.includes(s)));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Manage size columns">
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Visible Size Columns
          </p>
          {Object.entries(SIZE_GROUPS).map(([group, sizes]) => {
            const allSelected = sizes.every(s => visibleSizes.includes(s));
            const someSelected = sizes.some(s => visibleSizes.includes(s));
            return (
              <div key={group} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    // @ts-ignore - indeterminate is valid but not in types
                    data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
                    onCheckedChange={() => toggleGroup(group)}
                    className="h-3.5 w-3.5"
                  />
                  <Label className="text-xs font-medium cursor-pointer" onClick={() => toggleGroup(group)}>
                    {group}
                  </Label>
                </div>
                <div className="flex flex-wrap gap-1 pl-5">
                  {sizes.map(size => (
                    <button
                      key={size}
                      onClick={() => toggleSize(size)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        visibleSizes.includes(size)
                          ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                          : 'bg-muted/30 border-border text-muted-foreground hover:border-primary/20'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex gap-2 pt-1 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 flex-1"
              onClick={() => onVisibleSizesChange(DEFAULT_VISIBLE_SIZES)}
            >
              Reset
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 flex-1"
              onClick={() => onVisibleSizesChange(ALL_SIZES)}
            >
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 flex-1"
              onClick={() => onVisibleSizesChange([])}
            >
              None
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
