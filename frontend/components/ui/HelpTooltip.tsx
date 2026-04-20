import { HelpCircle } from "lucide-react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

interface HelpTooltipProps {
  content: string;
  className?: string;
}

/**
 * A small "?" icon that shows an explanatory tooltip on hover/focus.
 * Uses Radix Tooltip for accessibility.
 */
export default function HelpTooltip({ content, className = "" }: HelpTooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            tabIndex={0}
            className={`inline-flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full ${className}`}
            aria-label={`Help: ${content}`}
          >
            <HelpCircle className="w-3 h-3" />
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            align="center"
            sideOffset={4}
            className="z-[200] max-w-[220px] rounded-lg border border-border/50 bg-background/98 backdrop-blur-xl px-3 py-2 text-xs text-muted-foreground shadow-xl leading-relaxed animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-border/50" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
