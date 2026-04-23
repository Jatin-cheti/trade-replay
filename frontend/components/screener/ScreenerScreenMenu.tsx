import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Clock,
  Copy,
  Download,
  Edit2,
  Folder,
  Link2,
  Plus,
  Save,
  Share2,
  Trash2,
} from "lucide-react";
import type { SavedScreen } from "@/lib/screener";

interface ScreenerScreenMenuProps {
  activeScreenId: string | null;
  activeScreenName: string;
  savedScreens: SavedScreen[];
  screenDirty: boolean;
  isAuthenticated: boolean;
  saveScreen: (name?: string) => void;
  deleteScreenById: (id: string) => void;
  copyScreenById: (id: string) => void;
  renameScreenById: (id: string, name: string) => void;
  loadScreenState: (screen: SavedScreen) => void;
  onDownloadCSV: () => void;
}

export default function ScreenerScreenMenu({
  activeScreenId,
  activeScreenName,
  savedScreens,
  screenDirty,
  isAuthenticated,
  saveScreen,
  deleteScreenById,
  copyScreenById,
  renameScreenById,
  loadScreenState,
  onDownloadCSV,
}: ScreenerScreenMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openScreensOpen, setOpenScreensOpen] = useState(false);
  const [recentlyUsedOpen, setRecentlyUsedOpen] = useState(false);
  const [shareExpanded, setShareExpanded] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  // Save modal
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveInput, setSaveInput] = useState("");
  const [saveAsNew, setSaveAsNew] = useState(false);

  // Rename modal
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SavedScreen | null>(null);
  const [renameInput, setRenameInput] = useState("");

  // Toast feedback
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<SavedScreen | null>(null);

  const close = () => {
    setMenuOpen(false);
    setOpenScreensOpen(false);
    setRecentlyUsedOpen(false);
    setShareExpanded(false);
  };

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Close on outside page scroll/wheel, but keep menu open for scroll inside dropdown panels.
  useEffect(() => {
    if (!menuOpen) return;
    const handleScrollOrWheel = (e: Event) => {
      const target = e.target as Element | null;
      if (target?.closest?.("[data-dropdown-panel]")) return;
      close();
    };
    window.addEventListener("scroll", handleScrollOrWheel, true);
    window.addEventListener("wheel", handleScrollOrWheel, true);
    return () => {
      window.removeEventListener("scroll", handleScrollOrWheel, true);
      window.removeEventListener("wheel", handleScrollOrWheel, true);
    };
  }, [menuOpen]);

  const openSaveModal = useCallback((asNew: boolean) => {
    setSaveAsNew(asNew);
    setSaveInput(asNew ? "New screen" : activeScreenName);
    setSaveModalOpen(true);
    close();
  }, [activeScreenName]);

  const handleSave = useCallback(() => {
    if (!saveInput.trim()) return;
    saveScreen(saveInput.trim());
    setSaveModalOpen(false);
    showToast(saveAsNew ? "Screen created" : "Screen saved");
  }, [saveInput, saveAsNew, saveScreen, showToast]);

  const openRenameModal = useCallback((screen: SavedScreen) => {
    setRenameTarget(screen);
    setRenameInput(screen.name);
    setRenameModalOpen(true);
    close();
  }, []);

  const handleRename = useCallback(() => {
    if (!renameInput.trim() || !renameTarget) return;
    renameScreenById(renameTarget._id, renameInput.trim());
    setRenameModalOpen(false);
    setRenameTarget(null);
    showToast("Screen renamed");
  }, [renameInput, renameTarget, renameScreenById, showToast]);

  const handleCopyShareLink = useCallback(() => {
    const url = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setShareLinkCopied(true);
        setTimeout(() => setShareLinkCopied(false), 2000);
      }).catch(() => {
        // fallback: textarea
        const ta = document.createElement("textarea");
        ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); document.execCommand("copy");
        document.body.removeChild(ta);
        setShareLinkCopied(true);
        setTimeout(() => setShareLinkCopied(false), 2000);
      });
    } else {
      const ta = document.createElement("textarea");
      ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy");
      document.body.removeChild(ta);
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
    }
  }, []);

  const recentScreens = savedScreens.slice(0, 5);

  return (
    <>
      {/* Trigger button */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-border/55 bg-secondary/25 px-3 py-2 text-sm text-foreground transition-colors hover:border-border"
        >
          <span className="max-w-[140px] truncate">{activeScreenName}</span>
          {screenDirty && activeScreenId && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Unsaved changes" />
          )}
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <div data-dropdown-panel className="absolute left-0 top-full z-50 mt-1.5 w-[260px] rounded-xl border border-border/60 bg-background/98 shadow-2xl backdrop-blur-xl">
            {/* Header */}
            <div className="border-b border-border/40 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Screen</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{activeScreenName}</p>
              {screenDirty && activeScreenId && (
                <p className="mt-0.5 text-[10px] text-amber-400">Unsaved changes</p>
              )}
            </div>

            <div className="space-y-0.5 p-1.5">
              {isAuthenticated ? (
                <>
                  {/* Save */}
                  <button
                    type="button"
                    onClick={() => openSaveModal(false)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground/85 transition-colors hover:bg-secondary/50 hover:text-foreground"
                  >
                    <Save className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{activeScreenId ? "Save screen" : "Save screen…"}</span>
                    {screenDirty && activeScreenId && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400" />}
                  </button>

                  {/* Create new */}
                  <button
                    type="button"
                    onClick={() => openSaveModal(true)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground/85 transition-colors hover:bg-secondary/50 hover:text-foreground"
                  >
                    <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>Create new screen</span>
                  </button>

                  {/* Copy */}
                  {activeScreenId && (
                    <button
                      type="button"
                      onClick={() => { copyScreenById(activeScreenId); close(); showToast("Screen copied"); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground/85 transition-colors hover:bg-secondary/50 hover:text-foreground"
                    >
                      <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>Make a copy…</span>
                    </button>
                  )}

                  {/* Rename */}
                  {activeScreenId && (
                    <button
                      type="button"
                      onClick={() => {
                        const s = savedScreens.find((x) => x._id === activeScreenId);
                        if (s) openRenameModal(s);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground/85 transition-colors hover:bg-secondary/50 hover:text-foreground"
                    >
                      <Edit2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>Rename…</span>
                    </button>
                  )}
                </>
              ) : (
                <p className="px-3 py-2 text-xs text-muted-foreground">Log in to save screens</p>
              )}

              {/* Share screen */}
              <div>
                <button
                  type="button"
                  onClick={() => setShareExpanded((v) => !v)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground/85 transition-colors hover:bg-secondary/50 hover:text-foreground"
                >
                  <Share2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>Share screen</span>
                  <ChevronDown className={`ml-auto h-3 w-3 text-muted-foreground transition-transform ${shareExpanded ? "rotate-180" : ""}`} />
                </button>
                {shareExpanded && (
                  <div data-dropdown-panel className="mx-2 mb-1 rounded-lg border border-border/40 bg-secondary/20 p-2">
                    <p className="mb-1.5 text-[11px] text-muted-foreground">Copy the current view link</p>
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className="flex w-full items-center gap-2 rounded-md bg-primary/12 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      {shareLinkCopied ? "Copied!" : "Copy link"}
                    </button>
                  </div>
                )}
              </div>

              {/* Download CSV */}
              <button
                type="button"
                onClick={() => { onDownloadCSV(); close(); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground/85 transition-colors hover:bg-secondary/50 hover:text-foreground"
              >
                <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>Download as CSV</span>
              </button>

              {isAuthenticated && savedScreens.length > 0 && (
                <>
                  <div className="my-1 h-px bg-border/40" />

                  {/* Open screen */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setOpenScreensOpen((v) => !v)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground/85 transition-colors hover:bg-secondary/50 hover:text-foreground"
                    >
                      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>Open screen…</span>
                      <ChevronDown className={`ml-auto h-3 w-3 text-muted-foreground transition-transform ${openScreensOpen ? "rotate-180" : ""}`} />
                    </button>
                    {openScreensOpen && (
                      <div data-dropdown-panel className="mx-2 mb-1 max-h-52 overflow-auto rounded-lg border border-border/40 bg-secondary/20">
                        {savedScreens.map((screen) => (
                          <div key={screen._id} className="group flex items-center gap-1 px-1 py-0.5">
                            <button
                              type="button"
                              onClick={() => { loadScreenState(screen); close(); }}
                              className={`flex-1 truncate rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-primary/15 hover:text-foreground ${screen._id === activeScreenId ? "text-primary" : "text-foreground/80"}`}
                            >
                              {screen.name}
                            </button>
                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <button type="button" onClick={() => openRenameModal(screen)} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Rename">
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button type="button" onClick={() => setDeleteTarget(screen)} className="rounded p-1 text-muted-foreground hover:text-red-400" title="Delete">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recently used */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setRecentlyUsedOpen((v) => !v)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground/85 transition-colors hover:bg-secondary/50 hover:text-foreground"
                    >
                      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>Recently used</span>
                      <ChevronDown className={`ml-auto h-3 w-3 text-muted-foreground transition-transform ${recentlyUsedOpen ? "rotate-180" : ""}`} />
                    </button>
                    {recentlyUsedOpen && (
                      <div data-dropdown-panel className="mx-2 mb-1 rounded-lg border border-border/40 bg-secondary/20 p-1">
                        {recentScreens.map((screen) => (
                          <button
                            key={screen._id}
                            type="button"
                            onClick={() => { loadScreenState(screen); close(); }}
                            className="w-full truncate rounded px-2 py-1.5 text-left text-xs text-foreground/80 transition-colors hover:bg-primary/15 hover:text-foreground"
                          >
                            {screen.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Delete active screen */}
                  {activeScreenId && (
                    <>
                      <div className="my-1 h-px bg-border/40" />
                      <button
                        type="button"
                        onClick={() => {
                          const s = savedScreens.find((x) => x._id === activeScreenId);
                          if (s) setDeleteTarget(s);
                          close();
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4 shrink-0" />
                        <span>Delete screen</span>
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save / Create modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[360px] rounded-xl border border-border/60 bg-background p-6 shadow-2xl">
            <h2 className="mb-4 text-base font-semibold text-foreground">
              {saveAsNew ? "Create new screen" : "Save screen"}
            </h2>
            <input
              type="text"
              value={saveInput}
              onChange={(e) => setSaveInput(e.target.value)}
              placeholder="Screen name"
              className="mb-4 w-full rounded-lg border border-border/50 bg-secondary/25 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setSaveModalOpen(false);
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!saveInput.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renameModalOpen && renameTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[360px] rounded-xl border border-border/60 bg-background p-6 shadow-2xl">
            <h2 className="mb-4 text-base font-semibold text-foreground">Rename screen</h2>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="Screen name"
              className="mb-4 w-full rounded-lg border border-border/50 bg-secondary/25 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") { setRenameModalOpen(false); setRenameTarget(null); }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setRenameModalOpen(false); setRenameTarget(null); }}
                className="rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRename}
                disabled={!renameInput.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[360px] rounded-xl border border-border/60 bg-background p-6 shadow-2xl">
            <h2 className="mb-2 text-base font-semibold text-foreground">Delete screen?</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              &ldquo;{deleteTarget.name}&rdquo; will be permanently deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { deleteScreenById(deleteTarget._id); setDeleteTarget(null); showToast("Screen deleted"); }}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast feedback */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[110] -translate-x-1/2 rounded-lg bg-[#1e222d] px-4 py-2.5 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}
    </>
  );
}
