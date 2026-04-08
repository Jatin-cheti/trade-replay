/** Seconds-since-epoch timestamp (same alias used throughout the package). */
export type UTCTimestamp = number;

/** Lower-bound binary search: returns the smallest index where `arr[idx] >= target`. */
function lowerBound(arr: UTCTimestamp[], target: UTCTimestamp): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Canonical time axis for the chart.
 *
 * Maintains a sorted, deduplicated array of {@link UTCTimestamp}s that every
 * series shares.  Rendering loops use a position index `i` into this array so
 * that `series.getAt(i)` always corresponds to `timeIndex.at(i)`.
 *
 * Two update paths are supported:
 *
 * - **Bulk rebuild** (`rebuild`): replaces the entire array from multiple
 *   iterable sources in one pass.  Call this after `setData()` on any series.
 *
 * - **Streaming insert** (`insertOne`): inserts a single new timestamp in
 *   O(N) worst-case but O(1) amortised for monotonically-increasing streams
 *   (the common case for live market data).
 */
export class TimeIndex {
  private _times: UTCTimestamp[] = [];

  /** Read-only view of the sorted, deduplicated timestamp array. */
  get times(): readonly UTCTimestamp[] {
    return this._times;
  }

  /** Number of bars in the canonical axis. */
  get length(): number {
    return this._times.length;
  }

  /** Timestamp at position `i`, or `undefined` if out of range. */
  at(i: number): UTCTimestamp | undefined {
    return this._times[i];
  }

  /**
   * Estimated bar interval in seconds derived from the mean consecutive gap.
   * Returns `86400` (one day) when fewer than two bars exist.
   */
  interval(): number {
    if (this._times.length < 2) return 86400;
    return Math.round(
      (this._times[this._times.length - 1] - this._times[0]) /
        (this._times.length - 1),
    );
  }

  /**
   * Rebuild the canonical array from multiple timestamp sources in a single
   * pass.  All previous contents are discarded.
   *
   * Complexity: O(S·N + S·N·log(S·N)) where S = number of sources, N = bars.
   */
  rebuild(sources: Array<Iterable<UTCTimestamp>>): void {
    const set = new Set<UTCTimestamp>();
    for (const src of sources) {
      for (const t of src) set.add(t);
    }
    this._times = Array.from(set).sort((a, b) => a - b);
  }

  /** Clear all timestamps without releasing memory. */
  reset(): void {
    this._times = [];
  }

  /**
   * Insert a single timestamp in sorted order (no-op if already present).
   * Returns the index at which `t` resides after the operation.
   *
   * **Fast path**: when `t` is strictly greater than every existing timestamp
   * (the streaming live-bar case) this is an O(1) array push.
   */
  insertOne(t: UTCTimestamp): number {
    const len = this._times.length;
    if (len === 0 || this._times[len - 1] < t) {
      this._times.push(t);
      return len; // new last index
    }
    const idx = lowerBound(this._times, t);
    if (this._times[idx] !== t) {
      this._times.splice(idx, 0, t);
    }
    return idx;
  }

  /**
   * Return the index of `t`, or `-1` if not present.
   * Complexity: O(log N).
   */
  indexOf(t: UTCTimestamp): number {
    const idx = lowerBound(this._times, t);
    return this._times[idx] === t ? idx : -1;
  }

  /**
   * Return the index of the timestamp nearest to `t`.
   * Ties are broken in favour of the later timestamp.
   * Returns `-1` when the index is empty.
   */
  closestIndex(t: UTCTimestamp): number {
    if (this._times.length === 0) return -1;
    const idx = lowerBound(this._times, t);
    if (idx === 0) return 0;
    if (idx >= this._times.length) return this._times.length - 1;
    const before = this._times[idx - 1];
    const after = this._times[idx];
    return Math.abs(after - t) <= Math.abs(t - before) ? idx : idx - 1;
  }
}
