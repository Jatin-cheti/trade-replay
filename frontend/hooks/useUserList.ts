import { useCallback, useEffect, useMemo, useState } from "react";
import {
  defaultUserListAdapter,
  getUserListEntryKey,
  normalizeUserListLookupKey,
  type IUserListAdapter,
  type UserListEntry,
  type UserListKind,
} from "@/lib/userListAdapters";

interface UseUserListResult {
  entries: UserListEntry[];
  has: (lookupKey: string) => boolean;
  toggle: (entry: Omit<UserListEntry, "addedAt">) => boolean;
  remove: (lookupKey: string) => void;
  clear: () => void;
}

export function useUserList(
  kind: UserListKind,
  adapter: IUserListAdapter = defaultUserListAdapter,
): UseUserListResult {
  const [entries, setEntries] = useState<UserListEntry[]>(() => adapter.read(kind));

  useEffect(() => {
    adapter.write(kind, entries);
  }, [adapter, entries, kind]);

  const has = useCallback((lookupKey: string) => {
    const normalized = normalizeUserListLookupKey(lookupKey);
    return entries.some((entry) => getUserListEntryKey(entry) === normalized);
  }, [entries]);

  const toggle = useCallback((entry: Omit<UserListEntry, "addedAt">) => {
    const normalizedKey = getUserListEntryKey(entry);
    let added = false;

    setEntries((prev) => {
      const exists = prev.some((candidate) => getUserListEntryKey(candidate) === normalizedKey);
      if (exists) {
        added = false;
        return prev.filter((candidate) => getUserListEntryKey(candidate) !== normalizedKey);
      }

      added = true;
      return [
        {
          ...entry,
          addedAt: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 250);
    });

    return added;
  }, []);

  const remove = useCallback((lookupKey: string) => {
    const normalized = normalizeUserListLookupKey(lookupKey);
    setEntries((prev) => prev.filter((entry) => getUserListEntryKey(entry) !== normalized));
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  return useMemo(() => ({
    entries,
    has,
    toggle,
    remove,
    clear,
  }), [clear, entries, has, remove, toggle]);
}
