import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import AssetAvatar from "@/components/ui/AssetAvatar";

export interface SearchableDropdownItem {
  value: string;
  label: string;
  subtitle?: string;
  iconUrl?: string;
  isFallback?: boolean;
}

interface SearchableDropdownProps {
  items: SearchableDropdownItem[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  className?: string;
  disabled?: boolean;
}

export default function SearchableDropdown({
  items,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  className,
  disabled,
}: SearchableDropdownProps) {
  const selected = items.find((item) => item.value === value);
  const missingIconItems = useMemo(
    () => items.filter((item) => item.isFallback || !item.iconUrl).map((item) => item.label),
    [items],
  );

  useEffect(() => {
    if (missingIconItems.length === 0) return;
    for (const label of missingIconItems) {
      console.warn("Missing icon:", label);
    }
  }, [missingIconItems]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "premium-select w-full justify-between rounded-lg border-border/80 px-3 py-2.5 text-left text-sm text-foreground hover:bg-secondary/60",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {selected?.iconUrl ? <AssetAvatar src={selected.iconUrl} label={selected.label} className="h-4 w-4 rounded-full object-cover ring-1 ring-border/70" /> : null}
            <span className="truncate">{selected ? selected.label : placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 glass-strong border-border/70">
        <Command className="bg-transparent">
          <CommandInput placeholder={searchPlaceholder} className="premium-input h-10" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={`${item.value} ${item.label} ${item.subtitle ?? ""}`}
                  onSelect={() => onValueChange(item.value)}
                  className="rounded-md px-2.5 py-2 data-[selected=true]:bg-primary/20 data-[selected=true]:text-foreground"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      {item.iconUrl ? <AssetAvatar src={item.iconUrl} label={item.label} className="mt-0.5 h-4 w-4 rounded-full object-cover ring-1 ring-border/70" /> : null}
                      <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.label}
                      </p>
                      {item.subtitle ? (
                        <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                      ) : null}
                      </div>
                    </div>
                    <Check className={cn("h-4 w-4", value === item.value ? "opacity-100" : "opacity-0")} />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
