import { baseOptionSchema, type OptionField, type ToolOptions } from '@/services/tools/toolOptions';

type ToolOptionsPanelProps = {
  open: boolean;
  options: ToolOptions;
  optionsSchema?: OptionField[];
  onChange: (partial: Partial<ToolOptions>) => void;
};

export default function ToolOptionsPanel({ open, options, optionsSchema = baseOptionSchema, onChange }: ToolOptionsPanelProps) {
  if (!open) return null;

  const fields = optionsSchema.length ? optionsSchema : baseOptionSchema;

  return (
    <aside data-testid="tool-options-panel" className="absolute left-3 top-2 z-[35] w-[240px] rounded-xl border border-primary/25 bg-background/85 p-2 backdrop-blur-xl">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Tool Options</div>
      <div className="space-y-2">
        {fields.map((field) => {
          const value = options[field.key];
          const id = `tool-opt-${String(field.key)}`;

          if (field.type === 'toggle') {
            const enabled = Boolean(value);
            return (
              <button
                key={id}
                type="button"
                data-testid={`tool-option-${String(field.key)}`}
                className={`w-full rounded-md px-2 py-1 text-[11px] text-left ${enabled ? 'bg-primary/25 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'}`}
                onClick={() => onChange({ [field.key]: !enabled } as Partial<ToolOptions>)}
              >
                {field.label}: {enabled ? 'On' : 'Off'}
              </button>
            );
          }

          if (field.type === 'select') {
            return (
              <label key={id} className="block">
                <span className="mb-1 block text-[11px] text-muted-foreground">{field.label}</span>
                <select
                  data-testid={`tool-option-${String(field.key)}`}
                  value={String(value)}
                  onChange={(e) => onChange({ [field.key]: e.target.value } as Partial<ToolOptions>)}
                  className="w-full rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px]"
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            );
          }

          if (field.type === 'color') {
            return (
              <label key={id} className="block">
                <span className="mb-1 block text-[11px] text-muted-foreground">{field.label}</span>
                <input
                  data-testid={`tool-option-${String(field.key)}`}
                  type="color"
                  value={String(value)}
                  onChange={(e) => onChange({ [field.key]: e.target.value } as Partial<ToolOptions>)}
                  className="h-8 w-full rounded-md border border-border/60 bg-transparent"
                />
              </label>
            );
          }

          if (field.type === 'text') {
            return (
              <label key={id} className="block">
                <span className="mb-1 block text-[11px] text-muted-foreground">{field.label}</span>
                <input
                  data-testid={`tool-option-${String(field.key)}`}
                  type="text"
                  value={String(value)}
                  onChange={(e) => onChange({ [field.key]: e.target.value } as Partial<ToolOptions>)}
                  className="w-full rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px]"
                />
              </label>
            );
          }

          return (
            <label key={id} className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">{field.label}</span>
              <input
                data-testid={`tool-option-${String(field.key)}`}
                type={field.type === 'number' ? 'number' : 'range'}
                min={field.min}
                max={field.max}
                step={field.step}
                value={Number(value)}
                onChange={(e) => onChange({ [field.key]: Number(e.target.value) } as Partial<ToolOptions>)}
                className={field.type === 'number' ? 'w-full rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px]' : 'w-full'}
              />
            </label>
          );
        })}
      </div>
    </aside>
  );
}
