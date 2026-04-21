export type UserListKind = "watchlist" | "portfolio";

export interface UserListEntry {
  symbol: string;
  fullSymbol?: string;
  name?: string;
  exchange?: string;
  currency?: string;
  addedAt: string;
}

export interface IUserListAdapter {
  read(kind: UserListKind): UserListEntry[];
  write(kind: UserListKind, entries: UserListEntry[]): void;
}

const STORAGE_KEYS: Record<UserListKind, string> = {
  watchlist: "trade-replay:userlist:watchlist:v1",
  portfolio: "trade-replay:userlist:portfolio:v1",
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function sanitizeEntry(raw: unknown): UserListEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<UserListEntry>;
  if (typeof candidate.symbol !== "string" || !candidate.symbol.trim()) return null;

  return {
    symbol: normalizeSymbol(candidate.symbol),
    fullSymbol: typeof candidate.fullSymbol === "string" && candidate.fullSymbol.trim()
      ? normalizeSymbol(candidate.fullSymbol)
      : undefined,
    name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : undefined,
    exchange: typeof candidate.exchange === "string" && candidate.exchange.trim() ? candidate.exchange.trim() : undefined,
    currency: typeof candidate.currency === "string" && candidate.currency.trim() ? candidate.currency.trim() : undefined,
    addedAt: typeof candidate.addedAt === "string" && candidate.addedAt.trim()
      ? candidate.addedAt
      : new Date().toISOString(),
  };
}

export function getUserListEntryKey(entry: Pick<UserListEntry, "symbol" | "fullSymbol">): string {
  return normalizeSymbol(entry.fullSymbol || entry.symbol);
}

export function normalizeUserListLookupKey(value: string): string {
  return normalizeSymbol(value);
}

export class LocalStorageUserListAdapter implements IUserListAdapter {
  private readonly storage: Storage | null;

  constructor(storage?: Storage | null) {
    this.storage = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  }

  read(kind: UserListKind): UserListEntry[] {
    if (!this.storage) return [];
    const key = STORAGE_KEYS[kind];

    try {
      const raw = this.storage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((entry) => sanitizeEntry(entry))
        .filter((entry): entry is UserListEntry => entry !== null)
        .slice(0, 250);
    } catch {
      return [];
    }
  }

  write(kind: UserListKind, entries: UserListEntry[]): void {
    if (!this.storage) return;
    const key = STORAGE_KEYS[kind];

    try {
      this.storage.setItem(key, JSON.stringify(entries));
    } catch {
      // Ignore quota/storage write failures; UI state will still reflect current session.
    }
  }
}

export const defaultUserListAdapter = new LocalStorageUserListAdapter();
