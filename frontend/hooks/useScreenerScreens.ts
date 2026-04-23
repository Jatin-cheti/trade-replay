import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import type { SavedScreen } from "@/lib/screener";
import { parseCsv, parseFiltersFromSearch } from "@/lib/screener";

export function useScreenerScreens(routeType: string) {
  const { isAuthenticated } = useApp();
  const [searchParams] = useSearchParams();
  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>([]);
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);
  const [screenDirty, setScreenDirty] = useState(false);
  const [renamingScreenId, setRenamingScreenId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const loadScreens = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get<{ screens: SavedScreen[] }>("/screener/screens");
      setSavedScreens(res.data.screens);
    } catch { /* ignore */ }
  }, [isAuthenticated]);

  const loadedRef = useRef(false);
  useEffect(() => {
    if (!loadedRef.current) { loadedRef.current = true; void loadScreens(); }
  }, [loadScreens]);

  const saveScreen = useCallback(async (name?: string) => {
    if (!isAuthenticated) return;
    const payload = {
      name: name || "Unnamed screen",
      screenerType: routeType,
      tab: searchParams.get("tab") || "overview",
      columns: parseCsv(searchParams.get("columns") || ""),
      filters: parseFiltersFromSearch(searchParams),
      sort: searchParams.get("sort") || "marketCap",
      order: searchParams.get("order") || "desc",
      query: searchParams.get("q") || "",
    };
    try {
      if (activeScreenId) {
        await api.put(`/screener/screens/${activeScreenId}`, payload);
      } else {
        const res = await api.post<{ screen: SavedScreen }>("/screener/screens", payload);
        setActiveScreenId(res.data.screen._id);
      }
      setScreenDirty(false);
      void loadScreens();
    } catch { /* ignore */ }
  }, [isAuthenticated, routeType, searchParams, activeScreenId, loadScreens]);

  const deleteScreenById = useCallback(async (id: string) => {
    try {
      await api.delete(`/screener/screens/${id}`);
      if (activeScreenId === id) setActiveScreenId(null);
      void loadScreens();
    } catch { /* ignore */ }
  }, [activeScreenId, loadScreens]);

  const copyScreenById = useCallback(async (id: string) => {
    try {
      await api.post(`/screener/screens/${id}/copy`);
      void loadScreens();
    } catch { /* ignore */ }
  }, [loadScreens]);

  const renameScreenById = useCallback(async (id: string, newName: string) => {
    try {
      await api.put(`/screener/screens/${id}`, { name: newName });
      void loadScreens();
    } catch { /* ignore */ }
  }, [loadScreens]);

  const activeScreenName = savedScreens.find((s) => s._id === activeScreenId)?.name || "Unnamed screen";

  useEffect(() => {
    if (activeScreenId) setScreenDirty(true);
  }, [searchParams, activeScreenId]);

  return {
    isAuthenticated,
    savedScreens,
    activeScreenId, setActiveScreenId,
    activeScreenName,
    screenDirty, setScreenDirty,
    renamingScreenId, setRenamingScreenId,
    renameValue, setRenameValue,
    saveScreen, deleteScreenById, copyScreenById, renameScreenById,
  };
}
