import { useState, useCallback } from 'react';
import useLocalOrders from '../useLocalOrders';
import useFirestoreContext from '../useFirestoreContext';

/**
 * useHybridOrders - Combines local pending orders with Firestore orders
 *
 * This hook provides a unified view of:
 * 1. Local pending orders (not yet synced to Firestore)
 * 2. Synced orders from Firestore
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
  const { filterOrdersByDate } = useFirestoreContext();

  /**
   * Get all orders (local + Firestore)
   * Merges pending local orders with Firestore orders
   *
   * @returns {Array} Combined orders with syncStatus
   */
  const getAllOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch from both sources in parallel
      const [localOrders, firestoreOrders] = await Promise.all([
        getPendingOrders(),
        filterOrdersByDate()
      ]);

      console.log('📦 Local orders:', localOrders);
      console.log('☁️ Firestore orders:', firestoreOrders);

      // Create a map of Firestore order IDs for quick lookup
      const firestoreOrderIds = new Set(firestoreOrders.map(o => o.id));

      // Transform local orders to display format
      const localOrdersTransformed = localOrders
        .filter(order => !firestoreOrderIds.has(order.orderId)) // Only include if NOT in Firestore
        .map(order => ({
          // Use orderId as id for consistency
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
          isLocal: true // Flag to indicate this is a local order
        }));

      // Add syncStatus to Firestore orders
      const firestoreOrdersEnriched = firestoreOrders.map(order => ({
        ...order,
        syncStatus: 'synced',
        isLocal: false
      }));

      // Combine and sort by date (most recent first)
      const allOrders = [...localOrdersTransformed, ...firestoreOrdersEnriched];

      // Sort by date
      allOrders.sort((a, b) => {
        const dateA = getOrderDate(a);
        const dateB = getOrderDate(b);
        return dateB - dateA;
      });

      console.log('📊 Combined orders:', allOrders);

      setIsLoading(false);
      return allOrders;
    } catch (err) {
      console.error('❌ Error fetching hybrid orders:', err);
      setError(err.message);
      setIsLoading(false);
      return [];
    }
  }, [getPendingOrders, filterOrdersByDate]);

  return {
    getAllOrders,
    isLoading,
    error
  };
}

/**
 * Get date from order (handles both formats)
 */
function getOrderDate(order) {
  // New format: createdAt
  if (order.createdAt) {
    if (order.createdAt.toDate) {
      return order.createdAt.toDate();
    }
    if (order.createdAt instanceof Date) {
      return order.createdAt;
    }
    return new Date(order.createdAt);
  }

  // Old format: fecha (string)
  if (order.fecha) {
    const [datePart, timePart] = order.fecha.split(', ');
    const [day, month, year] = datePart.split('/');
    const formattedDate = `${year}-${month}-${day}`;
    return new Date(`${formattedDate}T${timePart}`);
  }

  return new Date(0);
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
