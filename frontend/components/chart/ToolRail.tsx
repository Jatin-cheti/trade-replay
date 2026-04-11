import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Box,
  Circle,
  Clock3,
  Fan,
  Flag,
  GitFork,
  GitMerge,
  Layers,
  Layers3,
  MessageCircle,
  MessageSquare,
  MessageSquareText,
  Minus,
  Mountain,
  MousePointer2,
  Move3d,
  Orbit,
  PencilLine,
  Pin,
  Play,
  Plus,
  RectangleHorizontal,
  Ruler,
  SeparatorVertical,
  Sparkles,
  Square,
  Tag,
  TrendingDown,
  TrendingUp,
  Type,
  Waves,
  ZoomIn,
} from 'lucide-react';
import { toolGroups, type ToolCategory, type ToolState, type ToolVariant } from '@/services/tools/toolRegistry';

const railIconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  MousePointer2,
  Move3d,
  Waves,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Layers,
  RectangleHorizontal,
  Circle,
  Play,
  PencilLine,
  Type,
  MessageSquare,
  Tag,
  MessageCircle,
  MessageSquareText,
  Pin,
  Sparkles,
  Minus,
  Plus,
  SeparatorVertical,
  Layers3,
  GitMerge,
  GitFork,
  TrendingUp,
  TrendingDown,
  Ruler,
  ZoomIn,
  Fan,
  Orbit,
  Clock3,
  Box,
  Square,
  Mountain,
  Activity,
  Flag,
};

type ToolRailProps = {
  toolState: ToolState;
  expandedCategory: ToolCategory | null;
  setExpandedCategory: (value: ToolCategory | null) => void;
  onVariant: (group: ToolCategory, variant: ToolVariant) => void;
  isMobile: boolean;
};

export default function ToolRail({
  toolState,
  expandedCategory,
  setExpandedCategory,
  onVariant,
  isMobile,
}: ToolRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [submenuStyle, setSubmenuStyle] = useState<React.CSSProperties>({});

  const activeGroup = toolGroups.find((g) => g.id === expandedCategory) ?? null;

  const positionSubmenu = useCallback(() => {
    if (!expandedCategory || !railRef.current) return;
    const btn = railRef.current.querySelector(`[data-rail-group="${expandedCategory}"]`) as HTMLElement | null;
    if (!btn) return;
    const btnRect = btn.getBoundingClientRect();
    const railRect = railRef.current.getBoundingClientRect();
    setSubmenuStyle({
      position: 'fixed',
      top: Math.max(4, btnRect.top),
      left: railRect.right + 4,
      zIndex: 60,
    });
  }, [expandedCategory]);

  useEffect(() => {
    positionSubmenu();
    window.addEventListener('resize', positionSubmenu);
    return () => window.removeEventListener('resize', positionSubmenu);
  }, [positionSubmenu]);

  useEffect(() => {
    if (!expandedCategory) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (railRef.current?.contains(target)) return;
      if (submenuRef.current?.contains(target)) return;
      setExpandedCategory(null);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [expandedCategory, setExpandedCategory]);

  const hasActiveVariantInGroup = (groupId: ToolCategory) =>
    toolGroups.find((g) => g.id === groupId)?.variants.some((v) => v.id === toolState.variant) ?? false;

  if (isMobile) return null;

  return (
    <>
      {/* Rail */}
      <div
        ref={railRef}
        data-testid="tool-rail"
        className="flex w-[44px] shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-primary/15 bg-background/60 py-1.5 backdrop-blur-xl"
      >
        {toolGroups.map((group) => {
          const Icon = railIconMap[group.railIcon] ?? Move3d;
          const isOpen = expandedCategory === group.id;
          const isActive = hasActiveVariantInGroup(group.id);
          return (
            <button
              key={group.id}
              type="button"
              data-testid={`rail-${group.id}`}
              data-rail-group={group.id}
              onClick={() => setExpandedCategory(isOpen ? null : group.id)}
              className={`flex h-[36px] w-[36px] items-center justify-center rounded-md transition ${
                isOpen
                  ? 'bg-primary/20 text-primary'
                  : isActive
                    ? 'bg-primary/10 text-primary/80'
                    : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
              }`}
              title={group.label}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>

      {/* Floating submenu */}
      {expandedCategory && activeGroup && (
        <div
          ref={submenuRef}
          data-testid={`submenu-${expandedCategory}`}
          style={submenuStyle}
          className="min-w-[200px] max-w-[260px] rounded-xl border border-primary/25 bg-background/90 p-1.5 shadow-xl shadow-black/40 backdrop-blur-xl"
        >
          <div className="mb-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {activeGroup.label}
          </div>
          <div className="max-h-[60vh] space-y-0.5 overflow-y-auto">
            {activeGroup.variants.map((variant) => {
              const Icon = railIconMap[variant.iconKey] ?? Move3d;
              const active = toolState.variant === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  data-testid={`tool-${variant.id}`}
                  onClick={() => {
                    onVariant(activeGroup.id, variant.id);
                    setExpandedCategory(null);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition ${
                    active
                      ? 'bg-primary/25 text-primary'
                      : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
                  }`}
                  title={variant.label}
                >
                  <Icon size={16} />
                  <span>{variant.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
