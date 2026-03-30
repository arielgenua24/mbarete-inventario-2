import { useState, useCallback } from 'react';
import useLocalOrders from '../useLocalOrders';
import useFirestoreContext from '../useFirestoreContext';
import {
  ORDER_SCOPES,
  matchesOrderScope,
  normalizeOrderLocation,
} from '../../utils/orderLocations';

const RAW_FIRESTORE_BATCH_SIZE = 20;

/**
 * useHybridOrders - Combines local pending orders with paginated Firestore orders
 *
 * This hook provides:
 * 1. getLocalOrders(scope) - Local pending orders filtered by branch scope
 * 2. getFirestoreOrdersPage(pageSize, startAfterDoc, scope) - Branch-aware paginated Firestore orders
 */
export default function useHybridOrders() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { getPendingOrders } = useLocalOrders();
  const { getOrdersPaginated } = useFirestoreContext();

  const getLocalOrders = useCallback(async (scope = ORDER_SCOPES.TOTAL) => {
    try {
      const localOrders = await getPendingOrders();

      return localOrders
        .filter(order => order.syncStatus !== 'synced')
        .map(order => normalizeOrderForUi(order, { isLocal: true }))
        .filter(order => matchesOrderScope(order, scope));
    } catch (err) {
      console.error('❌ Error fetching local orders:', err);
      return [];
    }
  }, [getPendingOrders]);

  const getFirestoreOrdersPage = useCallback(async (
    pageSize = 10,
    startAfterDoc = null,
    scope = ORDER_SCOPES.TOTAL
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const scopedOrders = [];
      const seenIds = new Set();
      let cursor = startAfterDoc;

      while (scopedOrders.length < pageSize) {
        const { orders, docs } = await getOrdersPaginated(RAW_FIRESTORE_BATCH_SIZE, cursor);

        if (!orders.length || !docs.length) {
          setIsLoading(false);
          return {
            orders: scopedOrders,
            lastVisibleDoc: cursor,
            hasMore: false
          };
        }

        for (let index = 0; index < orders.length; index += 1) {
          const rawOrder = normalizeOrderForUi(orders[index], { isLocal: false });
          const consumedDoc = docs[index];

          if (matchesOrderScope(rawOrder, scope) && !seenIds.has(rawOrder.id)) {
            scopedOrders.push(rawOrder);
            seenIds.add(rawOrder.id);
          }

          if (scopedOrders.length === pageSize) {
            const hasMoreInCurrentBatch = index < orders.length - 1;
            const maybeMoreAfterBatch = orders.length === RAW_FIRESTORE_BATCH_SIZE;

            setIsLoading(false);
            return {
              orders: scopedOrders,
              lastVisibleDoc: consumedDoc,
              hasMore: hasMoreInCurrentBatch || maybeMoreAfterBatch
            };
          }
        }

        if (orders.length < RAW_FIRESTORE_BATCH_SIZE) {
          const lastConsumedDoc = docs[docs.length - 1] || cursor;
          setIsLoading(false);
          return {
            orders: scopedOrders,
            lastVisibleDoc: lastConsumedDoc,
            hasMore: false
          };
        }

        cursor = docs[docs.length - 1];
      }

      setIsLoading(false);
      return {
        orders: scopedOrders,
        lastVisibleDoc: cursor,
        hasMore: false
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

function normalizeOrderForUi(order, { isLocal }) {
  const orderDate = order.fecha || formatDateToSpanish(order.createdAt);

  return {
    ...order,
    id: order.id || order.orderId,
    orderCode: order.orderCode || order.id || order.orderId,
    customerName: order.customerName || order.cliente || 'Cliente sin nombre',
    phone: order.phone || order.telefono || 'Sin teléfono',
    address: order.address || order.direccion || 'Sin dirección',
    totalAmount: Number(order.totalAmount || order.total || 0),
    status: order.status || order.estado || 'pendiente',
    cliente: order.cliente || order.customerName || 'Cliente sin nombre',
    telefono: order.telefono || order.phone || 'Sin teléfono',
    direccion: order.direccion || order.address || 'Sin dirección',
    estado: order.estado || order.status || 'pendiente',
    fecha: orderDate,
    location: normalizeOrderLocation(order),
    syncStatus: order.syncStatus || (isLocal ? 'pending' : 'synced'),
    isLocal
  };
}

function formatDateToSpanish(isoString) {
  if (!isoString) {
    return 'Sin fecha';
  }

  const date = isoString?.toDate ? isoString.toDate() : new Date(isoString);

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
