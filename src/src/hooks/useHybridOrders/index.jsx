import { useState, useCallback } from 'react';
import useLocalOrders from '../useLocalOrders';
import useFirestoreContext from '../useFirestoreContext';

/**
 * useHybridOrders - Combines local pending orders with paginated Firestore orders
 *
 * This hook provides:
 * 1. getLocalOrders() - All pending local orders (IndexedDB), always fetched in full
 * 2. getFirestoreOrdersPage() - One page of synced Firestore orders (cursor-based)
 *
 * Each order includes a syncStatus indicator:
 * - 'pending': Only in IndexedDB, waiting to sync
 * - 'syncing': Currently being synced (in progress)
 * - 'synced': Successfully synced to Firestore
 */
export default function useHybridOrders() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { getPendingOrders } = useLocalOrders();
  const { getOrdersPaginated } = useFirestoreContext();

  /**
   * Get all local/pending orders from IndexedDB.
   * Only returns orders not yet synced (pending, syncing, failed).
   * These are always few items, so we fetch all.
   */
  const getLocalOrders = useCallback(async () => {
    try {
      const localOrders = await getPendingOrders();

      // Only show orders that are NOT yet synced to Firestore
      // Synced orders will appear in the paginated Firestore results
      const localOrdersTransformed = localOrders
        .filter(order => order.syncStatus !== 'synced')
        .map(order => ({
          id: order.orderId,

          // New format fields
          orderCode: order.orderCode,
          customerName: order.customerName,
          phone: order.phone,
          address: order.address,
          products: order.products,
          totalAmount: order.totalAmount,
          status: order.status,
          createdAt: order.createdAt,

          // Legacy format fields (for backwards compatibility with UI)
          cliente: order.customerName,
          telefono: order.phone,
          direccion: order.address,
          estado: order.status,
          fecha: formatDateToSpanish(order.createdAt),

          // Sync metadata
          syncStatus: order.syncStatus || 'pending',
          isLocal: true
        }));

      return localOrdersTransformed;
    } catch (err) {
      console.error('❌ Error fetching local orders:', err);
      return [];
    }
  }, [getPendingOrders]);

  /**
   * Get one page of Firestore orders (cursor-based pagination)
   * @param {number} pageSize - Orders per page
   * @param {DocumentSnapshot|null} startAfterDoc - Cursor for next page
   * @returns {{ orders: Array, lastVisibleDoc, hasMore: boolean }}
   */
  const getFirestoreOrdersPage = useCallback(async (pageSize = 10, startAfterDoc = null) => {
    setIsLoading(true);
    setError(null);

    try {
      const { orders, lastVisibleDoc } = await getOrdersPaginated(pageSize, startAfterDoc);

      const enrichedOrders = orders.map(order => ({
        ...order,
        syncStatus: 'synced',
        isLocal: false
      }));

      setIsLoading(false);
      return {
        orders: enrichedOrders,
        lastVisibleDoc,
        hasMore: orders.length === pageSize
      };
    } catch (err) {
      console.error('❌ Error fetching Firestore orders page:', err);
      setError(err.message);
      setIsLoading(false);
      return { orders: [], lastVisibleDoc: null, hasMore: false };
    }
  }, [getOrdersPaginated]);

  return {
    getLocalOrders,
    getFirestoreOrdersPage,
    isLoading,
    error
  };
}

/**
 * Format ISO date to Spanish format
 * "2026-01-29T12:00:00.000Z" → "29/01/2026, 12:00"
 */
function formatDateToSpanish(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
