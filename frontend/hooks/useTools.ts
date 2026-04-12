import { useCallback, useRef, useState } from 'react';
import { clampOptionValue, defaultToolOptions, mergeToolOptions, type ToolOptions } from '@/services/tools/toolOptions';
import { buildToolOptions, type DrawPoint, type Drawing, type ToolState, type ToolVariant } from '@/services/tools/toolRegistry';
import { createDrawing, isPointOnlyVariant, updateDraftDrawing } from '@/services/tools/toolEngine';

function preserveVariantIndependentOptions(options: ToolOptions): Partial<ToolOptions> {
  const { extendLeft, extendRight, rayMode, priceLabel, axisLabel, snapMode, ...rest } = options;
  return rest;
}

const MAX_HISTORY_ENTRIES = 180;

function pushHistory(state: ToolState, drawings: Drawing[]): ToolState {
  const head = state.history.slice(0, state.historyIndex + 1);
  const history = [...head, drawings].slice(-MAX_HISTORY_ENTRIES);
  return { ...state, drawings, history, historyIndex: history.length - 1 };
}

export function useTools() {
  const [state, setState] = useState<ToolState>({
    activeTool: 'none',
    variant: 'none',
    options: defaultToolOptions,
    drawings: [],
    history: [[]],
    historyIndex: 0,
  });

  const draftRef = useRef<Drawing | null>(null);
  const drawingActiveRef = useRef(false);
  const drawingsRef = useRef<Drawing[]>([]);
  const historyRef = useRef<Drawing[][]>([[]]);
  const historyIndexRef = useRef(0);
  const variantRef = useRef<ToolVariant>('none');
  const optionsRef = useRef<ToolOptions>(defaultToolOptions);

  const setVariant = useCallback((variant: ToolVariant, activeTool: ToolState['activeTool']) => {
    // Tool switches should always cancel an in-progress draft to avoid ghost commits.
    draftRef.current = null;
    drawingActiveRef.current = false;
    const nextVariant = variantRef.current === variant ? 'none' : variant;
    variantRef.current = nextVariant;
    setState((prev) => ({
      ...prev,
      activeTool: prev.variant === variant ? 'none' : activeTool,
      variant: nextVariant,
      options: nextVariant === 'none'
        ? prev.options
        : (() => {
            const nextOptions = clampOptionValue(mergeToolOptions(buildToolOptions(nextVariant), preserveVariantIndependentOptions(optionsRef.current)));
            optionsRef.current = nextOptions;
            return nextOptions;
          })(),
    }));
  }, []);

  const setOptions = useCallback((partial: Partial<ToolOptions>) => {
    optionsRef.current = clampOptionValue(mergeToolOptions(optionsRef.current, partial));
    setState((prev) => ({
      ...prev,
      options: optionsRef.current,
    }));
  }, []);

  const mutateDrawings = useCallback((updater: (prev: Drawing[]) => Drawing[], commitHistory = true) => {
    const nextDrawings = updater(drawingsRef.current);
    drawingsRef.current = nextDrawings;

    if (!commitHistory) {
      setState((prev) => ({ ...prev, drawings: nextDrawings }));
      return;
    }

    setState((prev) => {
      const next = pushHistory(prev, nextDrawings);
      historyRef.current = next.history;
      historyIndexRef.current = next.historyIndex;
      return next;
    });
  }, []);

  const startDraft = useCallback((point: DrawPoint, text?: string) => {
    const variant = variantRef.current;
    if (variant === 'none') return { kind: 'none' as const };

    if (isPointOnlyVariant(variant)) {
      const drawing = createDrawing(variant, optionsRef.current, point, undefined, text);
      mutateDrawings((prev) => [...prev, drawing]);
      return { kind: 'finalized' as const };
    }

    drawingActiveRef.current = true;
    draftRef.current = createDrawing(variant, optionsRef.current, point, point, text);
    return { kind: 'draft' as const };
  }, [mutateDrawings]);

  const updateDraft = useCallback((point: DrawPoint) => {
    if (!drawingActiveRef.current || !draftRef.current) return;
    draftRef.current = updateDraftDrawing(draftRef.current, point);
  }, []);

  const finalizeDraft = useCallback(() => {
    if (!drawingActiveRef.current || !draftRef.current) return null;
    const done = draftRef.current;
    mutateDrawings((prev) => [...prev, done]);
    draftRef.current = null;
    drawingActiveRef.current = false;
    return done;
  }, [mutateDrawings]);

  const cancelDraft = useCallback(() => {
    draftRef.current = null;
    drawingActiveRef.current = false;
  }, []);

  const updateDrawing = useCallback((id: string, updater: (drawing: Drawing) => Drawing, commitHistory = true) => {
    mutateDrawings((prev) => prev.map((item) => (item.id === id ? updater(item) : item)), commitHistory);
  }, [mutateDrawings]);

  const updateAllDrawings = useCallback((updater: (drawings: Drawing[]) => Drawing[], commitHistory = true) => {
    mutateDrawings((prev) => updater(prev), commitHistory);
  }, [mutateDrawings]);

  const removeDrawing = useCallback((id: string) => {
    mutateDrawings((prev) => prev.filter((item) => item.id !== id));
  }, [mutateDrawings]);

  const clearDrawings = useCallback(() => {
    mutateDrawings(() => []);
    cancelDraft();
  }, [cancelDraft, mutateDrawings]);

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex <= 0) return prev;
      const nextIndex = prev.historyIndex - 1;
      const drawings = prev.history[nextIndex];
      drawingsRef.current = drawings;
      historyIndexRef.current = nextIndex;
      return { ...prev, historyIndex: nextIndex, drawings };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex >= prev.history.length - 1) return prev;
      const nextIndex = prev.historyIndex + 1;
      const drawings = prev.history[nextIndex];
      drawingsRef.current = drawings;
      historyIndexRef.current = nextIndex;
      return { ...prev, historyIndex: nextIndex, drawings };
    });
  }, []);

  const resetForSymbol = useCallback(() => {
    drawingsRef.current = [];
    historyRef.current = [[]];
    historyIndexRef.current = 0;
    variantRef.current = 'none';
    optionsRef.current = defaultToolOptions;
    setState((prev) => ({ ...prev, drawings: [], history: [[]], historyIndex: 0, variant: 'none', activeTool: 'none' }));
    cancelDraft();
  }, [cancelDraft]);

  return {
    toolState: state,
    drawingsRef,
    draftRef,
    drawingActiveRef,
    setVariant,
    setOptions,
    startDraft,
    updateDraft,
    finalizeDraft,
    cancelDraft,
    updateDrawing,
    updateAllDrawings,
    removeDrawing,
    clearDrawings,
    undo,
    redo,
    resetForSymbol,
  };
}
