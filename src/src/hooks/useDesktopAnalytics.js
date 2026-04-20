import { useState, useEffect, useMemo, useRef } from 'react';
import useFirestoreContext from './useFirestoreContext';

const LOW_STOCK_THRESHOLD = 5;

export function useDesktopAnalytics() {
  const { getOrdersForInboxPeriod, getAllProducts } = useFirestoreContext();
  const [monthlyOrders, setMonthlyOrders] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const [orders, products] = await Promise.all([
          getOrdersForInboxPeriod('monthly'),
          getAllProducts(),
        ]);
        setMonthlyOrders(orders);
        setAllProducts(products);
      } catch (e) {
        console.error('[DesktopAnalytics] fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // id → full product (imageUrl, stock, name, etc.)
  const productById = useMemo(() => {
    const m = {};
    allProducts.forEach(p => { m[p.id] = p; });
    return m;
  }, [allProducts]);

  // name → first imageUrl found across all size variants
  const imageByName = useMemo(() => {
    const m = {};
    allProducts.forEach(p => {
      if (p.name && !m[p.name]) m[p.name] = p.imageUrl || p.image2 || null;
    });
    return m;
  }, [allProducts]);

  // Aggregate qty + revenue from this month's orders — keyed by NAME so all
  // size variants of the same product collapse into one row.
  const salesByProduct = useMemo(() => {
    const m = {};
    monthlyOrders.forEach(order => {
      (order.products || []).forEach(item => {
        const id = item.productId;
        const name = item.productSnapshot?.name;
        const key = name || id;
        if (!key) return;
        const qty = Number(item.quantity) || Number(item.stock) || 1;
        const price = Number(item.productSnapshot?.price) || 0;
        const size =
          item.selectedVariants?.size ||
          item.productSnapshot?.size ||
          (id && productById[id]?.size) ||
          null;
        if (!m[key]) {
          m[key] = {
            id: id || null,
            name: name || key,
            qty: 0,
            revenue: 0,
            sizes: {},
          };
        }
        m[key].qty += qty;
        m[key].revenue += qty * price;
        const sizeKey = size ? String(size) : 'Sin talle';
        m[key].sizes[sizeKey] = (m[key].sizes[sizeKey] || 0) + qty;
      });
    });
    return Object.values(m).map(p => ({
      ...p,
      sizeBreakdown: Object.entries(p.sizes)
        .map(([size, qty]) => ({ size, qty }))
        .sort((a, b) => b.qty - a.qty),
      imageUrl: (p.id && productById[p.id]?.imageUrl) || imageByName[p.name] || null,
    }));
  }, [monthlyOrders, productById, imageByName]);

  const top5 = useMemo(() =>
    [...salesByProduct].sort((a, b) => b.qty - a.qty).slice(0, 5),
    [salesByProduct]
  );

  const bottom5 = useMemo(() =>
    [...salesByProduct]
      .filter(p => p.qty > 0)
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 5),
    [salesByProduct]
  );

  const lowStock = useMemo(() => {
    const salesQtyById = {};
    salesByProduct.forEach(p => { if (p.id) salesQtyById[p.id] = p.qty; });

    // Deduplicate by name (take lowest stock across size variants)
    const byName = {};
    allProducts
      .filter(p => Number(p.stock) >= 0 && Number(p.stock) <= LOW_STOCK_THRESHOLD)
      .forEach(p => {
        const existing = byName[p.name];
        if (!existing || Number(p.stock) < Number(existing.stock)) {
          byName[p.name] = p;
        }
      });

    return Object.values(byName)
      .map(p => ({
        ...p,
        monthlySales: salesQtyById[p.id] || 0,
        urgency: salesQtyById[p.id]
          ? salesQtyById[p.id] / Math.max(Number(p.stock), 0.5)
          : 0,
      }))
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 5);
  }, [allProducts, salesByProduct]);

  const pareto = useMemo(() => {
    const sorted = [...salesByProduct].sort((a, b) => b.revenue - a.revenue);
    const total = sorted.reduce((s, p) => s + p.revenue, 0);
    if (total === 0) return sorted.slice(0, 5).map(p => ({ ...p, pct: 0 }));

    let cumulative = 0;
    const result = [];
    for (const p of sorted) {
      if (cumulative / total >= 0.8) break;
      cumulative += p.revenue;
      result.push({ ...p, pct: Math.round((p.revenue / total) * 100) });
    }
    return result.slice(0, 8);
  }, [salesByProduct]);

  return { loading, top5, bottom5, lowStock, pareto };
}
