import { ChevronDown, Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Option<T extends string> = {
  value: T;
  label: string;
  subtitle?: string;
};

type PremiumSelectProps<T extends string> = {
  value: T;
  options: Array<Option<T>>;
  onChange: (next: T) => void;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
};

export default function PremiumSelect<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  searchable = false,
  className,
  open,
  onOpenChange,
}: PremiumSelectProps<T>) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionsListRef = useRef<HTMLDivElement | null>(null);
  const isOpen = open ?? internalOpen;

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(q) || option.subtitle?.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const handleOpenChange = (next: boolean) => {
    if (open === undefined) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
    if (!next) {
      setQuery('');
    }
  };

  const handleContentWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const list = optionsListRef.current;
    if (!list) {
      event.preventDefault();
      return;
    }

    const maxScrollTop = Math.max(0, list.scrollHeight - list.clientHeight);
    if (maxScrollTop <= 0) {
      event.preventDefault();
      return;
    }

    const nextScrollTop = Math.min(maxScrollTop, Math.max(0, list.scrollTop + event.deltaY));
    if (nextScrollTop !== list.scrollTop) {
      list.scrollTop = nextScrollTop;
    }
    event.preventDefault();
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className={`inline-flex min-w-[160px] items-center justify-between gap-2 rounded-lg border border-primary/20 bg-background/55 px-3 py-1.5 text-sm text-foreground transition hover:border-primary/45 hover:bg-background/75 ${className || ''}`}
        >
          <span className="truncate">{selected?.label || placeholder || 'Select'}</span>
          <ChevronDown size={14} className={`transition ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        data-premium-select-content="true"
        onWheel={handleContentWheel}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus({ preventScroll: true });
        }}
        className="w-[var(--radix-popover-trigger-width)] rounded-lg border border-primary/25 bg-background/95 p-2 shadow-[0_16px_34px_hsl(var(--background)/0.55)]"
      >
        {searchable && (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-border/60 bg-background/70 px-2 py-1">
            <Search size={13} className="text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="w-full bg-transparent text-xs text-foreground outline-none"
            />
          </div>
        )}
        <div ref={optionsListRef} className="max-h-[220px] overflow-y-auto overscroll-contain">
          {filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                handleOpenChange(false);
              }}
              className={`w-full rounded-md px-2 py-1.5 text-left transition ${value === option.value ? 'bg-primary/20 text-primary' : 'text-foreground hover:bg-secondary/45'}`}
            >
              <div className="text-xs font-medium">{option.label}</div>
              {option.subtitle && <div className="text-[10px] text-muted-foreground">{option.subtitle}</div>}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
