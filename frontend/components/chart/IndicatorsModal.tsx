import { useCallback, useMemo, useState } from 'react';
import { X, Search, Star, Lock, ChevronRight, Check, Sparkles, TrendingUp, BarChart3, DollarSign, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  technicalSections,
  financialSections,
  communitySections,
  sidebarItems,
  type CatalogEntry,
  type SidebarItem,
  type TechnicalSection,
} from '@/services/indicators/indicatorCatalog';

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface IndicatorsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabledIndicators: string[];
  onAddIndicator: (id: string) => void;
  onRemoveIndicator: (id: string) => void;
  /** IDs registered in the engine — used to grey out non-builtin entries */
  builtinIds: Set<string>;
}

/* ─── Section icon ──────────────────────────────────────────────────────── */

function sectionIcon(section: SidebarItem['section']) {
  switch (section) {
    case 'personal':
      return <Star size={14} />;
    case 'technicals':
      return <TrendingUp size={14} />;
    case 'financials':
      return <DollarSign size={14} />;
    case 'community':
      return <Users size={14} />;
  }
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function IndicatorsModal({
  open,
  onOpenChange,
  enabledIndicators,
  onAddIndicator,
  onRemoveIndicator,
  builtinIds,
}: IndicatorsModalProps) {
  const [activeSidebar, setActiveSidebar] = useState('technicals');
  const [search, setSearch] = useState('');
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  const enabledSet = useMemo(() => new Set(enabledIndicators), [enabledIndicators]);

  /* collect entries for active sidebar item */
  const activeSections = useMemo(() => {
    if (activeSidebar === 'myScripts' || activeSidebar === 'inviteOnly') {
      return [] as { label: string; items: CatalogEntry[] }[];
    }
    if (activeSidebar === 'technicals') return technicalSections;
    if (activeSidebar === 'financials') return financialSections;
    // community sub-items
    const community = communitySections.find((s) => s.subcategory === activeSidebar);
    if (community) return [community];
    return [] as { label: string; items: CatalogEntry[] }[];
  }, [activeSidebar]);

  /* search filter */
  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeSections;
    return activeSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [activeSections, search]);

  const handleToggle = useCallback(
    (id: string) => {
      if (enabledSet.has(id)) {
        onRemoveIndicator(id);
      } else {
        onAddIndicator(id);
      }
    },
    [enabledSet, onAddIndicator, onRemoveIndicator],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/70" />
        <div
          data-testid="indicators-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <div className="flex h-[min(85vh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-primary/25 bg-background shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-primary/15 px-5 py-3">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">Indicators, Metrics & Strategies</span>
              </div>
              <button
                type="button"
                data-testid="indicators-modal-close"
                onClick={() => onOpenChange(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search bar */}
            <div className="shrink-0 border-b border-primary/10 px-5 py-2.5">
              <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                <Search size={15} className="text-muted-foreground" />
                <input
                  data-testid="indicators-modal-search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search indicators, strategies, metrics…"
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  autoFocus
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Body: sidebar + content */}
            <div className="flex min-h-0 flex-1">
              {/* Sidebar */}
              <div className="w-[200px] shrink-0 border-r border-primary/10 bg-background/50">
                <ScrollArea className="h-full">
                  <div className="py-2">
                    {/* Personal */}
                    <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Personal</div>
                    {sidebarItems
                      .filter((i) => i.section === 'personal')
                      .map((item) => (
                        <SidebarButton key={item.id} item={item} active={activeSidebar === item.id} onClick={() => setActiveSidebar(item.id)} />
                      ))}

                    {/* Built-in */}
                    <div className="mt-3 px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Built-in</div>
                    {sidebarItems
                      .filter((i) => i.section === 'technicals' || i.section === 'financials')
                      .map((item) => (
                        <SidebarButton key={item.id} item={item} active={activeSidebar === item.id} onClick={() => setActiveSidebar(item.id)} />
                      ))}

                    {/* Community */}
                    <div className="mt-3 px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Community</div>
                    {sidebarItems
                      .filter((i) => i.section === 'community')
                      .map((item) => (
                        <SidebarButton key={item.id} item={item} active={activeSidebar === item.id} onClick={() => setActiveSidebar(item.id)} />
                      ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Content */}
              <ScrollArea className="flex-1">
                <div className="p-4">
                  {activeSidebar === 'myScripts' || activeSidebar === 'inviteOnly' ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Lock size={28} className="mb-3 text-muted-foreground/60" />
                      <p className="text-sm text-muted-foreground">
                        {activeSidebar === 'myScripts' ? 'Your personal scripts will appear here.' : 'Invite-only scripts will appear here.'}
                      </p>
                    </div>
                  ) : filteredSections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Search size={28} className="mb-3 text-muted-foreground/60" />
                      <p className="text-sm text-muted-foreground">No results found.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Active indicators summary */}
                      {enabledIndicators.length > 0 && !search.trim() && (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-400">
                            Active ({enabledIndicators.length})
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {enabledIndicators.map((id) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => onRemoveIndicator(id)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/25"
                              >
                                <Check size={11} />
                                {id.toUpperCase()}
                                <X size={10} className="ml-0.5 opacity-70" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {filteredSections.map((section) => (
                        <div key={section.label}>
                          <button
                            type="button"
                            onClick={() => setExpandedSub(expandedSub === section.label ? null : section.label)}
                            className="mb-2 flex w-full items-center gap-1.5 text-left"
                          >
                            <ChevronRight
                              size={14}
                              className={`text-muted-foreground transition-transform ${expandedSub === section.label || !search.trim() ? '' : '-rotate-90'}`}
                              style={{ transform: expandedSub === section.label || !search.trim() ? 'rotate(90deg)' : undefined }}
                            />
                            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{section.label}</span>
                            <span className="text-[10px] text-muted-foreground/70">({section.items.length})</span>
                          </button>
                          {(expandedSub === section.label || !search.trim() || search) && (
                            <div className="grid gap-0.5">
                              {section.items.map((item) => {
                                const isEnabled = enabledSet.has(item.id);
                                const isBuiltin = builtinIds.has(item.id);
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    data-testid={`indicator-catalog-${item.id}`}
                                    onClick={() => handleToggle(item.id)}
                                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-left transition ${
                                      isEnabled
                                        ? 'bg-emerald-500/10 text-foreground'
                                        : 'text-foreground hover:bg-primary/8'
                                    } ${!isBuiltin && !item.builtin ? 'opacity-60' : ''}`}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="truncate text-[13px]">{item.name}</span>
                                        {!isBuiltin && !item.builtin && (
                                          <span className="shrink-0 rounded bg-muted/50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                                            Coming Soon
                                          </span>
                                        )}
                                      </div>
                                      {item.description && (
                                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.description}</div>
                                      )}
                                    </div>
                                    <div className="ml-3 shrink-0">
                                      {isEnabled ? (
                                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-400">
                                          <Check size={10} /> Active
                                        </span>
                                      ) : isBuiltin ? (
                                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary/70">
                                          Add
                                        </span>
                                      ) : null}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}

/* ─── Sidebar button ────────────────────────────────────────────────────── */

function SidebarButton({ item, active, onClick }: { item: SidebarItem; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={`indicators-sidebar-${item.id}`}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[12px] transition ${
        active ? 'bg-primary/15 font-semibold text-primary' : 'text-foreground/80 hover:bg-primary/8 hover:text-foreground'
      }`}
    >
      {sectionIcon(item.section)}
      {item.label}
    </button>
  );
}
