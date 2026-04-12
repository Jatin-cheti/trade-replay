import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ToolVariant } from '@/services/tools/toolRegistry';

type IconTab = 'emoji' | 'sticker' | 'icon';

export type IconPresetSelection = {
  id: string;
  variant: Extract<ToolVariant, 'emoji' | 'sticker' | 'iconTool'>;
  title: string;
  label: string;
  defaultValue: string;
  preview?: boolean;
};

type CatalogItem = IconPresetSelection & {
  display: string;
  kind: 'emoji' | 'sticker' | 'symbol';
  tone?: string;
};

type CatalogSection = {
  id: string;
  label: string;
  topIcon: string;
  items: CatalogItem[];
};

type IconToolPanelProps = {
  defaultTab: IconTab;
  selectedPreset: IconPresetSelection | null;
  onSelectPreset: (preset: IconPresetSelection) => void;
};

function buildEmojiSection(id: string, label: string, topIcon: string, values: string[]): CatalogSection {
  return {
    id,
    label,
    topIcon,
    items: values.map((value, index) => ({
      id: `${id}-${index}`,
      variant: 'emoji',
      title: 'Emoji',
      label: 'Enter emoji',
      defaultValue: value,
      display: value,
      kind: 'emoji',
      preview: true,
    })),
  };
}

function buildStickerSection(
  id: string,
  label: string,
  topIcon: string,
  values: Array<{ id: string; display: string; defaultValue: string; tone: string }>,
): CatalogSection {
  return {
    id,
    label,
    topIcon,
    items: values.map((value) => ({
      id: `${id}-${value.id}`,
      variant: 'sticker',
      title: 'Sticker',
      label: 'Enter sticker text',
      defaultValue: value.defaultValue,
      display: value.display,
      kind: 'sticker',
      tone: value.tone,
      preview: true,
    })),
  };
}

function buildIconSection(id: string, label: string, topIcon: string, values: string[]): CatalogSection {
  return {
    id,
    label,
    topIcon,
    items: values.map((value, index) => ({
      id: `${id}-${index}`,
      variant: 'iconTool',
      title: 'Icon',
      label: 'Enter symbol',
      defaultValue: value,
      display: value,
      kind: 'symbol',
      preview: true,
    })),
  };
}

const emojiSections: CatalogSection[] = [
  buildEmojiSection('smiles', 'Smiles & People', '😀', ['😀', '😁', '😂', '🤣', '😊', '😇', '😉', '😍', '🤩', '😎', '🥳', '🤗']),
  buildEmojiSection('animals', 'Animals & Nature', '🐱', ['🐶', '🐱', '🐻', '🐼', '🦊', '🐵', '🐸', '🦁', '🐥', '🐳', '🌸', '🌿']),
  buildEmojiSection('food', 'Food & Drink', '🍔', ['🍎', '🍓', '🍒', '🍔', '🍕', '🌮', '🍣', '🍩', '🍿', '☕', '🥤', '🍰']),
  buildEmojiSection('activity', 'Activity', '⚽', ['⚽', '🏀', '🎾', '🏓', '🎧', '🎮', '🎨', '🎯', '🎲', '🚴', '🛹', '🏆']),
  buildEmojiSection('travel', 'Travel & Places', '🚀', ['🚗', '✈️', '🚀', '🚁', '🛳️', '🗺️', '🏝️', '🗽', '🗼', '🏔️', '🌍', '🌙']),
  buildEmojiSection('objects', 'Objects & Symbols', '💡', ['💡', '📌', '🔔', '🔥', '💎', '⭐', '💬', '📈', '📉', '⚙️', '🧠', '💼']),
  buildEmojiSection('flags', 'Flags', '⚑', ['🏁', '🚩', '⚑', '⚐', '🏳️', '🏴', '🌈', '🎌']),
];

const stickerSections: CatalogSection[] = [
  buildStickerSection('tradingview', 'TradingView', 'TV', [
    { id: 'tv-pine', display: 'PINE', defaultValue: 'PINE', tone: 'from-sky-400/20 via-blue-500/10 to-indigo-500/10' },
    { id: 'tv-replay', display: 'REPLAY', defaultValue: 'REPLAY', tone: 'from-cyan-400/20 via-sky-500/10 to-blue-500/10' },
    { id: 'tv-alert', display: 'ALERT', defaultValue: 'ALERT', tone: 'from-amber-400/20 via-orange-500/10 to-rose-500/10' },
    { id: 'tv-ideas', display: 'IDEAS', defaultValue: 'IDEAS', tone: 'from-fuchsia-400/20 via-purple-500/10 to-indigo-500/10' },
    { id: 'tv-chart', display: 'CHART', defaultValue: 'CHART', tone: 'from-emerald-400/20 via-teal-500/10 to-cyan-500/10' },
    { id: 'tv-templates', display: 'TEMPLATES', defaultValue: 'TEMPLATES', tone: 'from-zinc-300/20 via-slate-500/10 to-zinc-500/10' },
  ]),
  buildStickerSection('crypto', 'Crypto', '₿', [
    { id: 'wagmi', display: 'WAGMI', defaultValue: 'WAGMI', tone: 'from-emerald-400/20 via-lime-500/10 to-green-500/10' },
    { id: 'yolo', display: 'YOLO', defaultValue: 'YOLO', tone: 'from-fuchsia-400/20 via-pink-500/10 to-rose-500/10' },
    { id: 'hodl', display: 'HODL', defaultValue: 'HODL', tone: 'from-amber-400/20 via-orange-500/10 to-yellow-500/10' },
    { id: 'moon', display: 'MOON', defaultValue: 'MOON', tone: 'from-sky-400/20 via-blue-500/10 to-indigo-500/10' },
    { id: 'rekt', display: 'REKT', defaultValue: 'REKT', tone: 'from-rose-400/20 via-red-500/10 to-orange-500/10' },
    { id: 'rug', display: 'RUG', defaultValue: 'RUG', tone: 'from-slate-300/20 via-slate-500/10 to-zinc-500/10' },
  ]),
  buildStickerSection('reactions', 'Reactions', '🔥', [
    { id: 'bull', display: 'BULL', defaultValue: 'BULL', tone: 'from-emerald-400/20 via-lime-500/10 to-teal-500/10' },
    { id: 'bear', display: 'BEAR', defaultValue: 'BEAR', tone: 'from-slate-300/20 via-slate-500/10 to-zinc-500/10' },
    { id: 'buy', display: 'BUY', defaultValue: 'BUY', tone: 'from-cyan-400/20 via-blue-500/10 to-indigo-500/10' },
    { id: 'sell', display: 'SELL', defaultValue: 'SELL', tone: 'from-rose-400/20 via-red-500/10 to-orange-500/10' },
    { id: 'fomo', display: 'FOMO', defaultValue: 'FOMO', tone: 'from-fuchsia-400/20 via-pink-500/10 to-rose-500/10' },
    { id: 'lfg', display: 'LFG', defaultValue: 'LFG', tone: 'from-violet-400/20 via-purple-500/10 to-indigo-500/10' },
  ]),
];

const iconSections: CatalogSection[] = [
  buildIconSection('gestures', 'Gestures & Smileys', '✋', ['👍', '👎', '👆', '👇', '☝️', '✋', '🙌', '👏', '🤝', '👌', '✌️', '💪']),
  buildIconSection('symbols', 'Symbols & Flags', '⚑', ['⚑', '⚐', '★', '☆', '✓', '✕', '☑', '☐', '⊕', '⊖', '!', '?']),
  buildIconSection('nature', 'Nature', '☾', ['☀', '☾', '⚡', '☘', '🌿', '🍀', '🌸', '🪴', '🔥', '💧']),
  buildIconSection('currency', 'Currency', '€', ['€', '£', '$', '₹', '¥', '₽', '₩', '₿']),
  buildIconSection('objects', 'Objects', '⌂', ['⌂', '⏰', '📷', '⚙', '✉', '☎', '🔒', '🎁', '💾', '📌']),
];

const tabSections: Record<IconTab, CatalogSection[]> = {
  emoji: emojiSections,
  sticker: stickerSections,
  icon: iconSections,
};

const tabLabels: Record<IconTab, string> = {
  emoji: 'Emojis',
  sticker: 'Stickers',
  icon: 'Icons',
};

function getGridClass(tab: IconTab): string {
  if (tab === 'sticker') return 'grid grid-cols-3 gap-2';
  if (tab === 'icon') return 'grid grid-cols-6 gap-1.5';
  return 'grid grid-cols-8 gap-1.5';
}

function getTileClass(tab: IconTab, selected: boolean): string {
  const base = 'transition focus:outline-none focus:ring-2 focus:ring-primary/40';
  if (tab === 'sticker') {
    return cn(
      base,
      'min-h-[86px] rounded-2xl border px-2.5 py-2 text-left shadow-sm shadow-black/10',
      selected
        ? 'border-primary/50 bg-primary/10 shadow-primary/10'
        : 'border-border/70 bg-background/80 hover:border-primary/35 hover:bg-primary/5',
    );
  }

  return cn(
    base,
    tab === 'icon' ? 'h-10 w-10 rounded-lg border' : 'h-9 w-9 rounded-lg border',
    selected
      ? 'border-primary/50 bg-primary/10 text-primary shadow-sm shadow-primary/10'
      : 'border-border/70 bg-background/80 text-foreground/90 hover:border-primary/35 hover:bg-primary/10 hover:text-primary',
  );
}

function renderTile(item: CatalogItem, tab: IconTab, selected: boolean, onSelect: () => void) {
  if (tab === 'sticker') {
    return (
      <button
        key={item.id}
        type="button"
        data-testid={`icon-panel-item-${item.id}`}
        aria-pressed={selected}
        onClick={onSelect}
        title={item.label}
        className={cn(getTileClass(tab, selected), item.tone)}
      >
        <div className="flex h-full min-h-[62px] flex-col justify-between gap-2">
          <span className="block text-[16px] font-black tracking-[0.12em] text-foreground/95">{item.display}</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/65">{item.label}</span>
        </div>
      </button>
    );
  }

  return (
    <button
      key={item.id}
      type="button"
      data-testid={`icon-panel-item-${item.id}`}
      aria-pressed={selected}
      onClick={onSelect}
      title={item.label}
      className={getTileClass(tab, selected)}
    >
      <span className={tab === 'icon' ? 'text-[18px] leading-none' : 'text-[19px] leading-none'}>{item.display}</span>
    </button>
  );
}

export default function IconToolPanel({ defaultTab, selectedPreset, onSelectPreset }: IconToolPanelProps) {
  const [activeTab, setActiveTab] = useState<IconTab>(defaultTab);
  const [activeSection, setActiveSection] = useState<string>(() => tabSections[defaultTab][0]?.id ?? '');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const sections = tabSections[activeTab];

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    setActiveSection(sections[0]?.id ?? '');
  }, [activeTab, sections]);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      data-testid="icon-panel"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit]"
    >
      <div className="border-b border-border/70 bg-background/95 px-2.5 py-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                data-testid={`icon-panel-strip-${section.id}`}
                onClick={() => scrollToSection(section.id)}
                title={section.label}
                className={cn(
                  'flex h-9 min-w-9 items-center justify-center rounded-full border text-[17px] transition',
                  isActive
                    ? 'border-primary/35 bg-primary/15 text-primary shadow-sm shadow-primary/10'
                    : 'border-border/60 bg-background/80 text-foreground/80 hover:border-primary/25 hover:bg-primary/10 hover:text-primary',
                )}
              >
                <span aria-hidden="true">{section.topIcon}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div data-testid="icon-panel-scroll" className="min-h-0 flex-1 overflow-y-scroll px-2.5 py-2.5">
        <div className="space-y-3.5">
          {sections.map((section) => (
            <section
              key={section.id}
              ref={(node) => {
                sectionRefs.current[section.id] = node;
              }}
              data-testid={`icon-panel-section-${section.id}`}
              className="scroll-mt-3"
            >
              <div className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/75">
                {section.label}
              </div>
              <div className={getGridClass(activeTab)}>
                {section.items.map((item) => {
                  const selected = selectedPreset?.id === item.id;
                  return renderTile(item, activeTab, selected, () => onSelectPreset(item));
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 border-t border-border/70 bg-background/95 px-1.5 py-1.5 text-center">
        {(Object.keys(tabLabels) as IconTab[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              data-testid={`icon-panel-tab-${tab === 'emoji' ? 'emojis' : tab === 'sticker' ? 'stickers' : 'icons'}`}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'border-b-2 border-transparent py-2 text-[14px] font-medium transition',
                isActive ? 'border-primary text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tabLabels[tab]}
            </button>
          );
        })}
      </div>
    </div>
  );
}