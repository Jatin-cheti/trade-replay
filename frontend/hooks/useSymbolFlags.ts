import { useState, useCallback } from "react";

const STORAGE_KEY = "tradereplay_symbol_flags";

function loadFlags(): Record<string, string> {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}
function saveFlags(flags: Record<string, string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(flags)); } catch { /* quota */ }
}

export function useSymbolFlags() {
  const [flags, setFlagsState] = useState<Record<string, string>>(loadFlags);
  const setFlag = useCallback((fullSymbol: string, color: string | null) => {
    setFlagsState((prev) => {
      const next = { ...prev };
      if (color === null) { delete next[fullSymbol]; } else { next[fullSymbol] = color; }
      saveFlags(next);
      return next;
    });
  }, []);
  const getFlag = useCallback((fullSymbol: string): string | null => flags[fullSymbol] ?? null, [flags]);
  return { flags, setFlag, getFlag };
}
