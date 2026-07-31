import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { hasFinancialAccess } from '@/hooks/useJobs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const RECENT_KEY = 'jobs:recent';
const MAX_RECENT = 5;

export interface RecentJob {
  id: string;
  order_number: string | null;
  invoice_number: string | null;
  customer_name: string;
}

export function getRecentJobs(): RecentJob[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function pushRecentJob(job: RecentJob) {
  try {
    const current = getRecentJobs().filter((j) => j.id !== job.id);
    const next = [job, ...current].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

interface SearchResult {
  id: string;
  order_number: string | null;
  invoice_number: string | null;
  customer_name: string;
  status: string | null;
  stage: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalJobSearch({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentJob[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Refresh recent when opening
  useEffect(() => {
    if (open) {
      setRecent(getRecentJobs());
      setQuery('');
      setDebounced('');
      setResults([]);
      // focus after paint
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Server-side search
  useEffect(() => {
    if (!open) return;
    if (!debounced) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const q = debounced.replace(/[%,]/g, ' ').trim();
      const pattern = `%${q}%`;
      const { data, error } = await supabase
        .from('jobs')
        .select('id, order_number, invoice_number, customer_name, status, stage')
        .or(
          `customer_name.ilike.${pattern},order_number.ilike.${pattern},invoice_number.ilike.${pattern}`
        )
        .order('order_number', { ascending: false, nullsFirst: false })
        .limit(25);
      if (cancelled) return;
      if (!error && data) setResults(data as SearchResult[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  const selectJob = (job: RecentJob | SearchResult) => {
    pushRecentJob({
      id: job.id,
      order_number: job.order_number,
      invoice_number: job.invoice_number,
      customer_name: job.customer_name,
    });
    const isTeam = !hasFinancialAccess(role);
    const section = isTeam ? '?section=recipes' : '';
    onOpenChange(false);
    navigate(`/jobs/${job.id}${section}`);
  };

  const showRecent = !debounced && recent.length > 0;
  const showEmpty = debounced && !loading && results.length === 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-in fade-in-0">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-3 sm:px-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs by order #, customer, invoice..."
            className="pl-10 h-12 text-base"
            autoComplete="off"
            inputMode="search"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 shrink-0"
          onClick={() => onOpenChange(false)}
          aria-label="Close search"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {showRecent && (
          <div className="px-2 py-3 sm:px-4">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Recent jobs
            </p>
            <ul className="space-y-1">
              {recent.map((job) => (
                <ResultRow key={job.id} job={job} onSelect={() => selectJob(job)} />
              ))}
            </ul>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Searching...
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="px-2 py-3 sm:px-4">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Results ({results.length})
            </p>
            <ul className="space-y-1">
              {results.map((job) => (
                <ResultRow key={job.id} job={job} onSelect={() => selectJob(job)} />
              ))}
            </ul>
          </div>
        )}

        {showEmpty && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground px-6">
            <Search className="h-10 w-10 mb-3 opacity-30" />
            <p>No jobs match "{debounced}"</p>
          </div>
        )}

        {!debounced && recent.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground px-6">
            <Search className="h-10 w-10 mb-3 opacity-30" />
            <p>Start typing to search all jobs</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({
  job,
  onSelect,
}: {
  job: SearchResult | RecentJob;
  onSelect: () => void;
}) {
  const status = 'status' in job ? job.status : null;
  return (
    <li>
      <button
        onClick={onSelect}
        className={cn(
          'w-full text-left flex items-center gap-3 rounded-lg px-3 py-3.5 min-h-[56px]',
          'hover:bg-accent active:bg-accent/70 transition-colors'
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {job.order_number && (
              <Badge variant="outline" className="font-mono text-xs">
                #{job.order_number}
              </Badge>
            )}
            {job.invoice_number && (
              <Badge variant="secondary" className="font-mono text-xs">
                INV-{job.invoice_number}
              </Badge>
            )}
            {status && status !== 'pending' && (
              <Badge variant="outline" className="text-[10px] uppercase">
                {status.replace('_', ' ')}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-base font-medium truncate">{job.customer_name}</p>
        </div>
      </button>
    </li>
  );
}
