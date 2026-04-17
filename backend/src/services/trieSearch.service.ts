/**
 * trieSearch.service.ts — In-memory trie with incremental updates.
 *
 * Architecture:
 * - One initial build from DB on boot
 * - Incremental insert/update/remove — NO periodic full rebuilds
 * - O(k) prefix lookup on symbol + name
 * - Event-driven: call upsertAsset/removeAsset when data changes
 */
import { CleanAssetModel } from "../models/CleanAsset";
import { resolveLogo } from "./logoResolver.service";
import { logger } from "../utils/logger";

/* ── Types ─────────────────────────────────────────────────────────── */

interface TrieNode {
  children: Map<string, TrieNode>;
  entries: TrieEntry[];
}

export interface TrieEntry {
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

export interface SearchResult extends TrieEntry {}

/* ── Trie Core ─────────────────────────────────────────────────────── */

const MAX_ENTRIES_PER_NODE = 25;
const MAX_KEY_DEPTH = 8;

function createNode(): TrieNode {
  return { children: new Map(), entries: [] };
}

function insertEntry(root: TrieNode, key: string, entry: TrieEntry): void {
  let node = root;
  const lower = key.toLowerCase();
  for (let i = 0; i < lower.length && i < MAX_KEY_DEPTH; i++) {
    const ch = lower[i];
    let child = node.children.get(ch);
    if (!child) { child = createNode(); node.children.set(ch, child); }
    node = child;

    // Check if this fullSymbol is already in the node (dedup)
    const existingIdx = node.entries.findIndex(e => e.fullSymbol === entry.fullSymbol);
    if (existingIdx >= 0) {
      // Update in place
      node.entries[existingIdx] = entry;
      node.entries.sort((a, b) => b.priorityScore - a.priorityScore);
    } else if (node.entries.length < MAX_ENTRIES_PER_NODE) {
      node.entries.push(entry);
      node.entries.sort((a, b) => b.priorityScore - a.priorityScore);
    } else if (entry.priorityScore > node.entries[node.entries.length - 1].priorityScore) {
      node.entries[node.entries.length - 1] = entry;
      node.entries.sort((a, b) => b.priorityScore - a.priorityScore);
    }
  }
}

function removeEntry(root: TrieNode, key: string, fullSymbol: string): void {
  let node = root;
  const lower = key.toLowerCase();
  for (let i = 0; i < lower.length && i < MAX_KEY_DEPTH; i++) {
    const ch = lower[i];
    const child = node.children.get(ch);
    if (!child) return;
    node = child;
    node.entries = node.entries.filter(e => e.fullSymbol !== fullSymbol);
  }
}

function searchPrefix(root: TrieNode, prefix: string, limit: number): TrieEntry[] {
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
let entryCount = 0;
let lastBuildAt = 0;

/* ── Asset → TrieEntry helper ────────────────────────────────────── */

function assetToEntry(doc: any): TrieEntry {
  const logo = resolveLogo({
    symbol: doc.symbol,
    type: doc.type,
    exchange: doc.exchange,
    companyDomain: doc.companyDomain || "",
    iconUrl: doc.s3Icon || doc.iconUrl || "",
    s3Icon: doc.s3Icon || "",
    name: doc.name,
  });
  return {
    symbol: doc.symbol,
    fullSymbol: doc.fullSymbol,
    name: doc.name,
    exchange: doc.exchange,
    country: doc.country || "",
    type: doc.type,
    iconUrl: logo.iconUrl,
    priorityScore: doc.priorityScore || 0,
    isPrimaryListing: doc.isPrimaryListing || false,
    marketCap: doc.marketCap || 0,
  };
}

function insertAssetIntoTries(entry: TrieEntry): void {
  insertEntry(symbolTrie, entry.symbol, entry);
  if (entry.name) {
    insertEntry(nameTrie, entry.name, entry);
    const words = entry.name.split(/\s+/);
    for (let i = 1; i < words.length && i < 3; i++) {
      if (words[i].length >= 3) insertEntry(nameTrie, words[i], entry);
    }
  }
}

/* ── Initial Build (one-time on boot) ─────────────────────────────── */

export async function initTrieSearch(): Promise<void> {
  const startMs = Date.now();
  const newSymbolTrie = createNode();
  const newNameTrie = createNode();
  let count = 0;

  const BATCH = 5000;
  let skip = 0;
  while (true) {
    const docs = await CleanAssetModel.find({})
      .select("symbol fullSymbol name exchange country type iconUrl s3Icon priorityScore isPrimaryListing marketCap companyDomain")
      .sort({ priorityScore: -1 })
      .skip(skip).limit(BATCH).lean();
    if (docs.length === 0) break;

    for (const doc of docs) {
      const entry = assetToEntry(doc);
      // Insert into symbol trie
      insertEntry(newSymbolTrie, entry.symbol, entry);
      // Insert into name trie (full name + individual words)
      if (entry.name) {
        insertEntry(newNameTrie, entry.name, entry);
        const words = entry.name.split(/\s+/);
        for (let i = 1; i < words.length && i < 3; i++) {
          if (words[i].length >= 3) insertEntry(newNameTrie, words[i], entry);
        }
      }
      count++;
    }
    skip += docs.length;
    await new Promise<void>(r => setImmediate(r));
  }

  // Atomic swap
  symbolTrie = newSymbolTrie;
  nameTrie = newNameTrie;
  entryCount = count;
  isBuilt = true;
  lastBuildAt = Date.now();

  logger.info("trie_search_built", { entries: count, durationMs: Date.now() - startMs });
}

/* ── Incremental Updates (event-driven) ──────────────────────────── */

export function upsertAsset(doc: any): void {
  if (!isBuilt) return;
  const entry = assetToEntry(doc);
  insertAssetIntoTries(entry);
  entryCount++;  // approximate — dedup handled inside insertEntry
}

export function removeAsset(fullSymbol: string, symbol: string, name?: string): void {
  if (!isBuilt) return;
  removeEntry(symbolTrie, symbol, fullSymbol);
  if (name) {
    removeEntry(nameTrie, name, fullSymbol);
    const words = name.split(/\s+/);
    for (let i = 1; i < words.length && i < 3; i++) {
      if (words[i].length >= 3) removeEntry(nameTrie, words[i], fullSymbol);
    }
  }
}

/* ── Search API ──────────────────────────────────────────────────── */

export function trieSearchSymbols(query: string, limit = 20): SearchResult[] {
  if (!isBuilt || !query) return [];
  const q = query.trim();
  if (!q) return [];

  const symbolResults = searchPrefix(symbolTrie, q, limit);
  const nameResults = searchPrefix(nameTrie, q, limit);

  // Deduplicate by fullSymbol
  const seen = new Set<string>();
  const merged: SearchResult[] = [];
  for (const e of symbolResults) {
    if (!seen.has(e.fullSymbol)) { seen.add(e.fullSymbol); merged.push(e); }
  }
  for (const e of nameResults) {
    if (!seen.has(e.fullSymbol)) { seen.add(e.fullSymbol); merged.push(e); }
  }

  // Sort: exact match > prefix match > priorityScore
  const lq = q.toLowerCase();
  merged.sort((a, b) => {
    const aE = a.symbol.toLowerCase() === lq ? 2 : a.symbol.toLowerCase().startsWith(lq) ? 1 : 0;
    const bE = b.symbol.toLowerCase() === lq ? 2 : b.symbol.toLowerCase().startsWith(lq) ? 1 : 0;
    if (aE !== bE) return bE - aE;
    return b.priorityScore - a.priorityScore;
  });

  return merged.slice(0, limit);
}

export function isTrieReady(): boolean { return isBuilt; }

export function getTrieStats() {
  return { isBuilt, entryCount, lastBuildAt };
}