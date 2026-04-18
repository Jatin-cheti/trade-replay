/**
 * trieSearch.service.ts — In-memory trie for O(k) prefix symbol search.
 *
 * Loads all 102K clean assets into a trie on boot.
 * Symbol prefix and name prefix lookups in ~1ms.
 * Refreshed periodically to pick up new assets.
 */
import { CleanAssetModel } from "../models/CleanAsset";
import { resolveLogo } from "./logoResolver.service";
import { logger } from "../utils/logger";

/* ── Types ─────────────────────────────────────────────────────────── */

interface TrieNode {
  children: Map<string, TrieNode>;
  entries: TrieEntry[];
}

interface TrieEntry {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  iconUrl: string;
  priorityScore: number;
  isPrimaryListing: boolean;
  marketCap: number;
}

export interface SearchResult {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  iconUrl: string;
  priorityScore: number;
  isPrimaryListing: boolean;
  marketCap: number;
}

/* ── Trie Implementation ──────────────────────────────────────────── */

function createNode(): TrieNode {
  return { children: new Map(), entries: [] };
}

const MAX_ENTRIES_PER_NODE = 20; // Keep top 20 per prefix node

function insertIntoTrie(root: TrieNode, key: string, entry: TrieEntry): void {
  let node = root;
  const lower = key.toLowerCase();

  for (let i = 0; i < lower.length && i < 8; i++) {
    const ch = lower[i];
    let child = node.children.get(ch);
    if (!child) {
      child = createNode();
      node.children.set(ch, child);
    }
    node = child;

    // Insert entry at each depth level, keep sorted by priorityScore
    if (node.entries.length < MAX_ENTRIES_PER_NODE) {
      node.entries.push(entry);
      node.entries.sort((a, b) => b.priorityScore - a.priorityScore);
    } else if (entry.priorityScore > node.entries[node.entries.length - 1].priorityScore) {
      node.entries[node.entries.length - 1] = entry;
      node.entries.sort((a, b) => b.priorityScore - a.priorityScore);
    }
  }
}

function searchTrie(root: TrieNode, prefix: string, limit: number): TrieEntry[] {
  let node = root;
  const lower = prefix.toLowerCase();

  for (const ch of lower) {
    const child = node.children.get(ch);
    if (!child) return [];
    node = child;
  }

  return node.entries.slice(0, limit);
}

/* ── Global State ─────────────────────────────────────────────────── */

let symbolTrie = createNode();
let nameTrie = createNode();
let isBuilt = false;
let buildingInProgress = false;
let lastBuildAt = 0;
let entryCount = 0;

const REBUILD_INTERVAL_MS = 5 * 60 * 1000; // Rebuild every 5 minutes
let rebuildTimer: NodeJS.Timeout | null = null;

/* ── Build Trie from DB ──────────────────────────────────────────── */

async function buildTrie(): Promise<void> {
  if (buildingInProgress) return;
  buildingInProgress = true;

  const startMs = Date.now();
  const newSymbolTrie = createNode();
  const newNameTrie = createNode();
  let count = 0;

  try {
    // Use cursor-based streaming instead of skip/limit to avoid O(n²) on large collections
    const cursor = CleanAssetModel.find({})
      .select("symbol fullSymbol name exchange country type iconUrl s3Icon priorityScore isPrimaryListing marketCap companyDomain")
      .sort({ priorityScore: -1 })
      .lean()
      .cursor({ batchSize: 5000 });

    for await (const doc of cursor) {
      const logo = resolveLogo({
        symbol: doc.symbol,
        type: doc.type,
        exchange: doc.exchange,
        companyDomain: doc.companyDomain || "",
        iconUrl: doc.s3Icon || doc.iconUrl || "",
        s3Icon: doc.s3Icon || "",
        name: doc.name,
      });

      const entry: TrieEntry = {
        symbol: doc.symbol,
        fullSymbol: doc.fullSymbol,
        name: doc.name,
        exchange: doc.exchange,
        country: doc.country || "",
        type: doc.type,
        iconUrl: logo.iconUrl,
        priorityScore: doc.priorityScore || 0,
        isPrimaryListing: (doc as any).isPrimaryListing || false,
        marketCap: doc.marketCap || 0,
      };

      // Insert into symbol trie (e.g., "aapl", "tsla")
      insertIntoTrie(newSymbolTrie, doc.symbol, entry);

      // Insert into name trie (e.g., "apple", "tesla")
      if (doc.name) {
        insertIntoTrie(newNameTrie, doc.name, entry);
        const words = doc.name.split(/\s+/);
        if (words.length > 1) {
          for (let i = 1; i < words.length && i < 3; i++) {
            if (words[i].length >= 3) {
              insertIntoTrie(newNameTrie, words[i], entry);
            }
          }
        }
      }

      count++;
      // Yield to event loop every 5000 entries
      if (count % 5000 === 0) await new Promise<void>((resolve) => setImmediate(resolve));
    }

    // Atomic swap
    symbolTrie = newSymbolTrie;
    nameTrie = newNameTrie;
    entryCount = count;
    isBuilt = true;
    lastBuildAt = Date.now();

    logger.info("trie_search_built", {
      entries: count,
      durationMs: Date.now() - startMs,
    });
  } catch (err) {
    logger.error("trie_search_build_error", { error: (err as Error).message });
  } finally {
    buildingInProgress = false;
  }
}

/* ── Public API ───────────────────────────────────────────────────── */

export async function initTrieSearch(): Promise<void> {
  await buildTrie();

  if (rebuildTimer) clearInterval(rebuildTimer);
  rebuildTimer = setInterval(() => void buildTrie(), REBUILD_INTERVAL_MS);
  rebuildTimer.unref();

  logger.info("trie_search_initialized", { rebuildIntervalMs: REBUILD_INTERVAL_MS });
}

export function trieSearchSymbols(query: string, limit = 20): SearchResult[] {
  if (!isBuilt || !query || query.length === 0) return [];

  const q = query.trim();
  if (q.length === 0) return [];

  // Search both tries and merge
  const symbolResults = searchTrie(symbolTrie, q, limit);
  const nameResults = searchTrie(nameTrie, q, limit);

  // Deduplicate by fullSymbol, prefer symbol matches
  const seen = new Set<string>();
  const merged: SearchResult[] = [];

  // Symbol matches first (exact symbol type-ahead)
  for (const entry of symbolResults) {
    if (!seen.has(entry.fullSymbol)) {
      seen.add(entry.fullSymbol);
      merged.push(entry);
    }
  }

  // Then name matches
  for (const entry of nameResults) {
    if (!seen.has(entry.fullSymbol)) {
      seen.add(entry.fullSymbol);
      merged.push(entry);
    }
  }

  // Sort merged by: exact symbol match first, then priorityScore
  const lowerQ = q.toLowerCase();
  merged.sort((a, b) => {
    const aExact = a.symbol.toLowerCase() === lowerQ ? 1 : 0;
    const bExact = b.symbol.toLowerCase() === lowerQ ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    const aPrefix = a.symbol.toLowerCase().startsWith(lowerQ) ? 1 : 0;
    const bPrefix = b.symbol.toLowerCase().startsWith(lowerQ) ? 1 : 0;
    if (aPrefix !== bPrefix) return bPrefix - aPrefix;

    return b.priorityScore - a.priorityScore;
  });

  return merged.slice(0, limit);
}

export function isTrieReady(): boolean {
  return isBuilt;
}

export function getTrieStats(): {
  isBuilt: boolean;
  entryCount: number;
  lastBuildAt: number;
} {
  return { isBuilt, entryCount, lastBuildAt };
}


/* ── Incremental Updates ──────────────────────────────────────────── */

export function upsertAsset(doc: any): void {
  if (!doc || !doc.symbol) return;
  const entry: TrieEntry = {
    symbol: doc.symbol,
    fullSymbol: doc.fullSymbol || doc.symbol,
    name: doc.name || doc.symbol,
    exchange: doc.exchange || "",
    country: doc.country || "",
    type: doc.type || "unknown",
    iconUrl: resolveLogo(doc).iconUrl,
    priorityScore: doc.priorityScore ?? 0,
    isPrimaryListing: doc.isPrimaryListing ?? false,
    marketCap: doc.marketCap ?? 0,
  };
  insertIntoTrie(symbolTrie, entry.symbol, entry);
  if (entry.name) {
    insertIntoTrie(nameTrie, entry.name, entry);
    for (const word of entry.name.split(/\s+/).slice(1)) {
      if (word.length >= 2) insertIntoTrie(nameTrie, word, entry);
    }
  }
}

export function removeAsset(_fullSymbol: string, _symbol: string, _name?: string): void {
  // Trie node removal is complex; schedule a full rebuild instead.
  // initTrieSearch rebuilds from DB which will exclude the removed asset.
  initTrieSearch().catch((err) => logger.error("trie_rebuild_after_remove_failed", { error: err.message }));
}