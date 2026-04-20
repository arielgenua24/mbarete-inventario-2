import { useEffect, useMemo, useRef, useState } from 'react';
import useFirestoreContext from './useFirestoreContext';
import { getRollingWeeks, getTopProductInRange, sumOrderTotalsInRange } from '../utils/weekUtils';
import {
  getWeeklyTopByKeys,
  saveManyWeeklyTops,
  pruneWeeksBefore,
} from '../services/weeklyTopCache';
import { getWithTTL, setWithTTL, TTL_1H } from '../utils/cache';

const TTL_2H = 2 * TTL_1H;
const MONTHS_BACK = 4;
const HIGHLIGHTS_CACHE_KEY = 'mb_ttl_home_highlights_v1';
const CURRENT_WEEK_CACHE_KEY = 'mb_ttl_home_current_week_v1';
const PRODUCTS_CACHE_KEY = 'mb_ttl_home_products_v1';
const TOTAL_SALES_CACHE_KEY = 'mb_ttl_home_total_sales_v1';

/**
 * Drives the weekly top-product grid + the three header highlights.
 *
 * Caching strategy:
 *   – closed weeks  → persistent IndexedDB (weeklyTopProducts store)
 *   – current week  → 2h TTL in localStorage
 *   – highlights    → 2h TTL in localStorage (today / this week / last month)
 *   – products      → 2h TTL in localStorage (reused from analytics panel feel)
 */
export function useWeeklyTopProducts() {
  const { getOrdersByDateRangeBounded, getAllProducts } = useFirestoreContext();
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState([]);
  const [highlights, setHighlights] = useState({ today: null, thisWeek: null, lastMonth: null });
  const [totalLast4Months, setTotalLast4Months] = useState(0);
  const [cachedAt, setCachedAt] = useState(null);
  const fetchedRef = useRef(false);

  const skeleton = useMemo(() => getRollingWeeks(MONTHS_BACK), []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const now = new Date();
        // ── Load products (2h cached) ─────────────────────────────
        const cachedProducts = getWithTTL(PRODUCTS_CACHE_KEY);
        const products = cachedProducts
          ? cachedProducts.data
          : await (async () => {
              const p = await getAllProducts();
              setWithTTL(PRODUCTS_CACHE_KEY, p, TTL_2H);
              return p;
            })();
        const productById = {};
        products.forEach(p => { productById[p.id] = p; });

        // ── Closed weeks from IndexedDB ───────────────────────────
        const closedWeeks = skeleton.filter(w => w.isPast);
        const cachedRows = await getWeeklyTopByKeys(closedWeeks.map(w => w.weekKey));

        // Drop entries older than the visible window
        const earliestVisible = skeleton[0]?.start.getTime();
        if (earliestVisible) pruneWeeksBefore(earliestVisible);

        const missingClosed = closedWeeks.filter(w => !cachedRows[w.weekKey]);
        const currentWeek = skeleton.find(w => w.isCurrent) || null;

        // ── Current week + highlights from 2h TTL ─────────────────
        const cachedCurrent = currentWeek ? getWithTTL(CURRENT_WEEK_CACHE_KEY) : null;
        const cachedHighlights = getWithTTL(HIGHLIGHTS_CACHE_KEY);

        const cachedTotal = getWithTTL(TOTAL_SALES_CACHE_KEY);
        const needCurrent = !!currentWeek && !cachedCurrent;
        const needHighlights = !cachedHighlights;
        const needTotal = !cachedTotal;
        const needFetch =
          missingClosed.length > 0 || needCurrent || needHighlights || needTotal;

        let freshOrders = null;
        if (needFetch) {
          // Fetch the smallest range that covers everything we need.
          const starts = [];
          if (missingClosed.length) starts.push(missingClosed[0].start);
          if (needTotal && skeleton.length) {
            starts.push(skeleton[0].start);
          }
          if (needCurrent || needHighlights) {
            // today-1-month covers "last month" highlight safely
            const oneMonthAgo = new Date(now);
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            oneMonthAgo.setDate(1);
            oneMonthAgo.setHours(0, 0, 0, 0);
            starts.push(oneMonthAgo);
            if (currentWeek) starts.push(currentWeek.start);
          }
          const fetchStart = new Date(Math.min(...starts.map(d => d.getTime())));
          const fetchEnd = new Date(now);
          fetchEnd.setHours(23, 59, 59, 999);
          freshOrders = await getOrdersByDateRangeBounded(fetchStart, fetchEnd);
        }

        // ── Fill closed weeks from cache or aggregation ───────────
        const weekResults = skeleton.map(w => {
          if (w.isPast) {
            const row = cachedRows[w.weekKey];
            if (row) return { ...w, topProduct: row.topProduct };
            const top = freshOrders
              ? getTopProductInRange(freshOrders, w.start, w.end, productById)
              : null;
            return { ...w, topProduct: top };
          }
          if (w.isCurrent) {
            const top = cachedCurrent
              ? cachedCurrent.data
              : freshOrders
                ? getTopProductInRange(freshOrders, w.start, w.end, productById)
                : null;
            return { ...w, topProduct: top };
          }
          // future
          return { ...w, topProduct: null };
        });

        // Persist newly-computed closed weeks to IndexedDB
        const newlyComputedClosed = weekResults
          .filter(w => w.isPast && !cachedRows[w.weekKey])
          .map(w => ({
            weekKey: w.weekKey,
            monthKey: w.monthKey,
            endTime: w.endTime,
            topProduct: w.topProduct,
          }));
        if (newlyComputedClosed.length) saveManyWeeklyTops(newlyComputedClosed);

        // Persist current week to 2h TTL
        if (currentWeek && !cachedCurrent) {
          const cw = weekResults.find(w => w.isCurrent);
          if (cw) setWithTTL(CURRENT_WEEK_CACHE_KEY, cw.topProduct, TTL_2H);
        }

        // ── Highlights ────────────────────────────────────────────
        let resolvedHighlights;
        if (cachedHighlights) {
          resolvedHighlights = cachedHighlights.data;
        } else if (freshOrders) {
          resolvedHighlights = computeHighlights(freshOrders, productById, now);
          setWithTTL(HIGHLIGHTS_CACHE_KEY, resolvedHighlights, TTL_2H);
        } else {
          resolvedHighlights = { today: null, thisWeek: null, lastMonth: null };
        }

        // ── Total sales over the 4-month window ────────────────────
        let resolvedTotal;
        if (cachedTotal) {
          resolvedTotal = cachedTotal.data;
        } else if (freshOrders && skeleton.length) {
          const windowStart = skeleton[0].start;
          const windowEnd = skeleton[skeleton.length - 1].end;
          resolvedTotal = sumOrderTotalsInRange(freshOrders, windowStart, windowEnd);
          setWithTTL(TOTAL_SALES_CACHE_KEY, resolvedTotal, TTL_2H);
        } else {
          resolvedTotal = 0;
        }

        setWeeks(weekResults);
        setHighlights(resolvedHighlights);
        setTotalLast4Months(resolvedTotal);
        setCachedAt(cachedHighlights?.cachedAt ?? Date.now());
      } catch (e) {
        console.error('[useWeeklyTopProducts] fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { loading, weeks, highlights, totalLast4Months, cachedAt };
}

function computeHighlights(orders, productById, now) {
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

  // This week = current month-aligned chunk containing today
  const dayOfMonth = now.getDate();
  const chunkIdx = Math.floor((dayOfMonth - 1) / 7);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), chunkIdx * 7 + 1, 0, 0, 0, 0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);

  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  return {
    today: getTopProductInRange(orders, todayStart, todayEnd, productById),
    thisWeek: getTopProductInRange(orders, weekStart, weekEnd, productById),
    lastMonth: getTopProductInRange(orders, lastMonthStart, lastMonthEnd, productById),
  };
}

