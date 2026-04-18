import { X } from "lucide-react";

export function FilterChip({
  label,
  onRemove,
  onEdit,
}: {
  label: string;
  onRemove: () => void;
  onEdit?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25 active:bg-primary/35"
    >
      <span className="truncate max-w-[150px] md:max-w-[200px]">{label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-primary/70 transition-colors hover:bg-primary/30 hover:text-primary flex-shrink-0"
        title="Remove filter"
      >
        <X className="h-3 w-3" />
      </button>
    </button>
  );
}
