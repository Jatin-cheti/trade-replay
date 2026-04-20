/**
 * useSavedPeriods — hook managing saved custom time ranges in localStorage.
 * Persists across sessions. Provides full CRUD operations.
 */

import { useCallback, useState } from "react";
import type { CustomRange } from "./CustomRangePicker";

export interface SavedPeriod {
  id: string;
  name: string;
  range: CustomRange;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "tradereplay:saved-periods";

function loadFromStorage(): SavedPeriod[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{
      id: string;
      name: string;
      range: {
        mode: string;
        from: string;
        to: string;
        label?: string;
      };
      createdAt: string;
      updatedAt: string;
    }>;
    return parsed.map((p) => ({
      ...p,
      range: {
        ...p.range,
        mode: p.range.mode as CustomRange["mode"],
        from: new Date(p.range.from),
        to: new Date(p.range.to),
      },
    }));
  } catch {
    return [];
  }
}

function saveToStorage(periods: SavedPeriod[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(periods));
  } catch {
    // localStorage unavailable (private mode, quota exceeded, etc.)
  }
}

function generateId() {
  return `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useSavedPeriods() {
  const [periods, setPeriods] = useState<SavedPeriod[]>(() => loadFromStorage());

  const sync = useCallback((next: SavedPeriod[]) => {
    setPeriods(next);
    saveToStorage(next);
  }, []);

  const create = useCallback(
    (name: string, range: CustomRange): SavedPeriod | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      // Duplicate name check
      const existing = periods.find(
        (p) => p.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) return null; // caller should handle duplicate error
      const now = new Date().toISOString();
      const np: SavedPeriod = {
        id: generateId(),
        name: trimmed,
        range,
        createdAt: now,
        updatedAt: now,
      };
      sync([...periods, np]);
      return np;
    },
    [periods, sync]
  );

  const update = useCallback(
    (id: string, patch: { name?: string; range?: CustomRange }): boolean => {
      const idx = periods.findIndex((p) => p.id === id);
      if (idx === -1) return false;
      const trimmedName = patch.name?.trim();
      if (trimmedName) {
        // Duplicate name check (excluding self)
        const dup = periods.find(
          (p) => p.id !== id && p.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (dup) return false;
      }
      const next = [...periods];
      next[idx] = {
        ...next[idx],
        ...(trimmedName ? { name: trimmedName } : {}),
        ...(patch.range ? { range: patch.range } : {}),
        updatedAt: new Date().toISOString(),
      };
      sync(next);
      return true;
    },
    [periods, sync]
  );

  const remove = useCallback(
    (id: string) => {
      sync(periods.filter((p) => p.id !== id));
    },
    [periods, sync]
  );

  const isDuplicateName = useCallback(
    (name: string, excludeId?: string) => {
      const lower = name.trim().toLowerCase();
      return periods.some(
        (p) => p.name.toLowerCase() === lower && p.id !== excludeId
      );
    },
    [periods]
  );

  return { periods, create, update, remove, isDuplicateName };
}
