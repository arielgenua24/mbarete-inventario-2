import { getMonthNameEs } from './dateUtils';
import { getOrderTotalValue } from './orderLocations';

/**
 * Generates a rolling list of weeks covering the last `monthsBack` calendar
 * months (including the current month).
 *
 * Week chunks are month-aligned: days 1–7, 8–14, 15–21, 22–28, 29–end.
 * This matches the labelling used elsewhere in the app (dateUtils.getMonthWeeks).
 *
 * Each week entry is classified as past | current | future relative to `now`.
 * Future weeks are still returned (they fill the current month) so the grid
 * can render them as disabled cells.
 *
 * @param {number} monthsBack  – number of months to include (default 4)
 * @param {Date}   now         – reference date (default: today)
 * @returns {Array<{ weekKey, monthKey, monthLabel, weekNum, start, end, endTime, isPast, isCurrent, isFuture }>}
 */
export function getRollingWeeks(monthsBack = 4, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const firstMonth = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
  const weeks = [];

  for (let m = 0; m < monthsBack; m++) {
    const monthDate = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + m, 1);
    const year = monthDate.getFullYear();
    const monthIdx = monthDate.getMonth();
    const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    const monthLabel = getMonthNameEs(monthDate);
    const monthEnd = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);

    let weekNum = 1;
    let cursor = new Date(year, monthIdx, 1, 0, 0, 0, 0);

    while (cursor <= monthEnd) {
      const start = new Date(cursor);
      const rawEnd = new Date(cursor);
      rawEnd.setDate(rawEnd.getDate() + 6);
      rawEnd.setHours(23, 59, 59, 999);
      const end = rawEnd > monthEnd ? new Date(monthEnd) : rawEnd;

      const isFuture = start > today;
      const isPast = end < today;
      const isCurrent = !isFuture && !isPast;

      weeks.push({
        weekKey: `${monthKey}-W${weekNum}`,
        monthKey,
        monthLabel,
        weekNum,
        start,
        end,
        endTime: end.getTime(), // used as an index for bulk cleanup
        isPast,
        isCurrent,
        isFuture,
      });

      weekNum++;
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  return weeks;
}

/**
 * Given an orders array and a [start, end] range, aggregates product sales
 * (by name, falling back to product-catalog lookup when the order snapshot
 * is missing the name) and returns the single top-selling product.
 *
 * @returns {{ id, name, imageUrl, qty } | null}
 */
export function getTopProductInRange(orders, start, end, productById = {}) {
  const startTime = start instanceof Date ? start.getTime() : new Date(start).getTime();
  const endTime = end instanceof Date ? end.getTime() : new Date(end).getTime();

  const bucket = {};

  orders.forEach(order => {
    const orderTime = getOrderTimestamp(order);
    if (orderTime == null) return;
    if (orderTime < startTime || orderTime > endTime) return;

    (order.products || []).forEach(item => {
      const id = item.productId;
      const name = item.productSnapshot?.name || (id && productById[id]?.name) || null;
      const key = name || id;
      if (!key) return;

      const qty = Number(item.quantity) || Number(item.stock) || 1;
      if (!bucket[key]) {
        bucket[key] = {
          id: id || null,
          name: name || key,
          qty: 0,
        };
      }
      bucket[key].qty += qty;
    });
  });

  const entries = Object.values(bucket).sort((a, b) => b.qty - a.qty);
  const top = entries[0];
  if (!top) return null;

  const imageUrl =
    (top.id && (productById[top.id]?.imageUrl || productById[top.id]?.image2)) || null;

  return { id: top.id, name: top.name, imageUrl, qty: top.qty };
}

/**
 * Firestore orders may carry `createdAt` as a Timestamp, plain ISO string,
 * or serialized `{ seconds, nanoseconds }` (when re-read from localStorage).
 */
export function sumOrderTotalsInRange(orders, start, end) {
  const startTime = start instanceof Date ? start.getTime() : new Date(start).getTime();
  const endTime = end instanceof Date ? end.getTime() : new Date(end).getTime();
  let sum = 0;
  for (const order of orders) {
    const t = getOrderTimestamp(order);
    if (t == null || t < startTime || t > endTime) continue;
    sum += Number(getOrderTotalValue(order)) || 0;
  }
  return sum;
}

export function getOrderTimestamp(order) {
  const raw = order?.createdAt;
  if (!raw) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const t = Date.parse(raw);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof raw.toMillis === 'function') return raw.toMillis();
  if (typeof raw.seconds === 'number') return raw.seconds * 1000;
  if (raw instanceof Date) return raw.getTime();
  return null;
}
