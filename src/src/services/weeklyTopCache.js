import { db } from '../db/indexedDB';

/**
 * Persistent per-week cache of the top-selling product.
 *
 * Closed (past) weeks are immutable, so we cache them forever in IndexedDB.
 * The current week is NOT stored here — it lives in a short-TTL localStorage
 * entry handled by the hook.
 */

export async function getWeeklyTopByKeys(weekKeys) {
  if (!weekKeys?.length) return {};
  try {
    const rows = await db.weeklyTopProducts.where('weekKey').anyOf(weekKeys).toArray();
    const map = {};
    rows.forEach(r => { map[r.weekKey] = r; });
    return map;
  } catch (e) {
    console.error('[weeklyTopCache] read failed:', e);
    return {};
  }
}

export async function saveWeeklyTop(entry) {
  try {
    await db.weeklyTopProducts.put({
      weekKey: entry.weekKey,
      monthKey: entry.monthKey,
      endTime: entry.endTime,
      topProduct: entry.topProduct, // { id, name, imageUrl, qty } | null
      cachedAt: Date.now(),
    });
  } catch (e) {
    console.error('[weeklyTopCache] write failed:', e);
  }
}

export async function saveManyWeeklyTops(entries) {
  if (!entries?.length) return;
  try {
    await db.weeklyTopProducts.bulkPut(
      entries.map(e => ({
        weekKey: e.weekKey,
        monthKey: e.monthKey,
        endTime: e.endTime,
        topProduct: e.topProduct,
        cachedAt: Date.now(),
      }))
    );
  } catch (e) {
    console.error('[weeklyTopCache] bulk write failed:', e);
  }
}

/**
 * Drop entries whose weeks ended before `cutoffTime`.
 * Called opportunistically so the store doesn't grow unbounded.
 */
export async function pruneWeeksBefore(cutoffTime) {
  try {
    await db.weeklyTopProducts.where('endTime').below(cutoffTime).delete();
  } catch (e) {
    console.error('[weeklyTopCache] prune failed:', e);
  }
}
