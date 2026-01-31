import { useState } from 'react';
import { useJobs } from '@/hooks/useJobs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Link2, Search, X, Check } from 'lucide-react';
import { format } from 'date-fns';

interface JobPickerProps {
  value: string | null;
  onChange: (jobId: string | null, jobInfo?: { customer: string; orderNumber: string | null }) => void;
  label?: string;
  className?: string;
}

export function JobPicker({ value, onChange, label = 'Link to Job', className }: JobPickerProps) {
  const { jobs, isLoading } = useJobs();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedJob = value ? jobs.find((j) => j.id === value) : null;

  const filteredJobs = jobs.filter((job) => {
    const query = search.toLowerCase();
    return (
      job.customer_name.toLowerCase().includes(query) ||
      job.order_number?.toLowerCase().includes(query) ||
      job.invoice_number?.toLowerCase().includes(query) ||
      job.description?.toLowerCase().includes(query)
    );
  });

  const handleSelect = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      onChange(jobId, { customer: job.customer_name, orderNumber: job.order_number });
    }
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label className="text-sm">{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-start text-left font-normal',
              !selectedJob && 'text-muted-foreground'
            )}
          >
            <Link2 className="mr-2 h-4 w-4 shrink-0" />
            {selectedJob ? (
              <span className="flex-1 truncate">
                {selectedJob.order_number && `#${selectedJob.order_number} - `}
                {selectedJob.customer_name}
              </span>
            ) : (
              <span className="flex-1">Select a job...</span>
            )}
            {selectedJob && (
              <X
                className="ml-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 p-0 focus-visible:ring-0 h-8"
            />
          </div>
          <ScrollArea className="h-[250px]">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading jobs...
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No jobs found
              </div>
            ) : (
              <div className="p-1">
                {filteredJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => handleSelect(job.id)}
                    className={cn(
                      'w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent',
                      value === job.id && 'bg-accent'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {job.order_number && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              #{job.order_number}
                            </Badge>
                          )}
                          <span className="font-medium truncate">{job.customer_name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {job.description || format(new Date(job.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      {value === job.id && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
