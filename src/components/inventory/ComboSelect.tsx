import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ComboSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

export function ComboSelect({ value, onChange, options, placeholder, className }: ComboSelectProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter(o =>
    o.toLowerCase().includes((filter || value || '').toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <Input
        value={open ? filter : value}
        onChange={(e) => {
          setFilter(e.target.value);
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setFilter(value);
        }}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
          {filtered.slice(0, 30).map((opt) => (
            <button
              key={opt}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt);
                setOpen(false);
                setFilter('');
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
