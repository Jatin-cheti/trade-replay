import type { UTCTimestamp } from './timeIndex';
import type { TimeIndex } from './timeIndex';

/** Minimum shape required for rows stored in a SeriesStore. */
export interface TimedRow {
  time: UTCTimestamp;
}

/**
 * Stores series data **aligned to a shared {@link TimeIndex}**.
 *
 * `getAt(i)` returns the row whose `time === timeIndex.at(i)`, or `null` when
 * the series has no value for that bar (sparse series or missing bars due to
 * calendar gaps / different data sources).
 *
 * ### Two update paths
 *
 * **Full replace** (`setData` → chart calls `rebuildIndex()`)
 * - Store the new rows as source-of-truth; do *not* touch the shared index yet.
 * - The chart collects all series' raw rows, rebuilds the TimeIndex once, then
 *   calls `realign()` on every store.  This ensures a consistent index even
 *   when multiple series are reset in the same tick.
 *
 * **Fast tail update** (`update` → chart patches index and aligned slots)
 * - Replace the last bar in O(1) when the timestamp matches.
 * - Append a new bar: the chart inserts the timestamp into the TimeIndex and
 *   calls `grow()` on all other stores so every store stays in sync without a
 *   full rebuild.
 */
export class SeriesStore<T extends TimedRow> {
  /** Source-of-truth rows in the order they were provided. */
  private _rows: T[] = [];
  /**
   * Aligned lookup array: `_aligned[i]` is the row at `timeIndex.at(i)`,
   * or `null` if this series has no data for that bar.
   */
  private _aligned: (T | null)[] = [];
  private readonly _index: TimeIndex;

  constructor(index: TimeIndex) {
    this._index = index;
  }

  /** Raw, unaligned source rows (source-of-truth for rebuilding). */
  get rawRows(): readonly T[] {
    return this._rows;
  }

  /** Number of aligned slots — equals `_index.length` after `realign()`. */
  get length(): number {
    return this._aligned.length;
  }

  /**
   * Get the row at time-index position `i`, or `null` if absent or
   * out-of-bounds.  O(1).
   */
  getAt(i: number): T | null {
    return i >= 0 && i < this._aligned.length ? this._aligned[i] : null;
  }

  /**
   * Full replace: store `rows` as the new source-of-truth.
   *
   * **Does NOT touch the shared TimeIndex.**  The chart must call
   * `rebuildIndex()` (which calls `realign()` on all stores) after all series
   * have been `setData`-ed so the shared index is rebuilt exactly once.
   */
  setData(rows: T[]): void {
    this._rows = rows.slice();
    this._aligned = []; // rebuilt by realign()
  }

  /**
   * Rebuild `_aligned` to match the current state of the shared TimeIndex.
   *
   * The chart calls this on *every* store after rebuilding the TimeIndex so
   * that all stores are consistent at the same instant.
   */
  realign(): void {
    const n = this._index.length;
    const next: (T | null)[] = new Array<T | null>(n).fill(null);
    for (const row of this._rows) {
      const i = this._index.indexOf(row.time);
      if (i >= 0) next[i] = row;
    }
    this._aligned = next;
  }

  /**
   * Fast update for the live (last) bar.
   *
   * - **Replace in place** when `row.time` matches the last stored row — O(1),
   *   no index rebuild needed.
   * - **Append** otherwise — O(1) push to `_rows`; the chart must then insert
   *   the timestamp into the TimeIndex and call `grow()` / `setAt()` on the
   *   affected stores.
   *
   * Returns `'replaced'` or `'appended'` so the chart can dispatch follow-up
   * steps without re-examining the row.
   */
  update(row: T): 'replaced' | 'appended' {
    const t = row.time;
    if (
      this._rows.length > 0 &&
      this._rows[this._rows.length - 1].time === t
    ) {
      this._rows[this._rows.length - 1] = row;
      // Update the aligned slot — for streaming this is always the last slot.
      const lastAligned = this._aligned.length - 1;
      if (lastAligned >= 0 && this._index.at(lastAligned) === t) {
        this._aligned[lastAligned] = row;
      }
      return 'replaced';
    }
    this._rows.push(row);
    return 'appended';
  }

  /**
   * Grow the aligned array to `n` slots, filling new slots with `null`.
   *
   * Called on **all** stores (other than the one being updated) after a new
   * timestamp is inserted into the shared TimeIndex, so every store's aligned
   * array stays the same length as the index.
   */
  grow(n: number): void {
    while (this._aligned.length < n) this._aligned.push(null);
  }

  /**
   * Set the aligned slot at index `i` to `row`.
   * Grows the array with `null` entries if necessary.
   */
  setAt(i: number, row: T): void {
    while (this._aligned.length <= i) this._aligned.push(null);
    this._aligned[i] = row;
  }

  /** Drop all data (keeps the TimeIndex reference intact). */
  clear(): void {
    this._rows = [];
    this._aligned = [];
  }
}
