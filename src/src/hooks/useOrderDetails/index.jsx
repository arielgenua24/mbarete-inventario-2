import { useState, useCallback } from 'react';
import useLocalOrders from '../useLocalOrders';
import useFirestoreContext from '../useFirestoreContext';

const normalizeVariantToken = (value) => {
  if (value === undefined || value === null) return 'na';
  const normalized = String(value).trim().toLowerCase();
  return normalized || 'na';
};

const buildLineItemId = (product, index) => {
  const productId = String(product?.productId ?? product?.id ?? 'unknown');
  const size = normalizeVariantToken(product?.selectedVariants?.size);
  const color = normalizeVariantToken(product?.selectedVariants?.color);
  return `${productId}__${size}__${color}__${index}`;
};

/**
 * useOrderDetails - Fetch order details from IndexedDB or Firestore
 *
 * This hook provides a unified way to get order data regardless of where it's stored:
 * 1. Try IndexedDB first (local pending orders)
 * 2. Fall back to Firestore (synced orders)
 *
 * Handles both order formats:
 * - New format: products as array with productSnapshot
 * - Old format: products as subcollection with productRef
 */
export default function useOrderDetails() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { getOrderById: getLocalOrder } = useLocalOrders();
  const { getProductsByOrder, getOrderById: getFirestoreOrder } = useFirestoreContext();

  /**
   * Get order data with products
   *
   * @param {string} orderId - The order ID
   * @returns {Object} Order data with products array
   */
  const getOrderWithProducts = useCallback(async (orderId) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`🔍 Fetching order details for: ${orderId}`);

      // Step 1: Try IndexedDB first (local orders)
      let localOrder = null;
      try {
        localOrder = await getLocalOrder(orderId);
      } catch (err) {
        console.log('📦 Order not in IndexedDB, trying Firestore...');
      }

      if (localOrder) {
        console.log('✅ Found order in IndexedDB:', localOrder);

        // Transform to verification format
        const transformedProducts = localOrder.products.map((product, index) => ({
          id: buildLineItemId(product, index),
          stock: product.quantity,
          verified: 0, // Start with 0 verified
          productSnapshot: product.productSnapshot,
          selectedVariants: product.selectedVariants,
          lineItemId: buildLineItemId(product, index),
          // For compatibility with old UI
          productData: product.productSnapshot
        }));

        setIsLoading(false);
        return {
          order: localOrder,
          products: transformedProducts,
          source: 'indexeddb',
          format: 'new'
        };
      }

      // Step 2: Try Firestore (synced orders)
      console.log('☁️ Fetching from Firestore...');

      // Get order document
      const firestoreOrder = await getFirestoreOrder(orderId);

      if (!firestoreOrder) {
        throw new Error(`Order ${orderId} not found in IndexedDB or Firestore`);
      }

      // Check if order has products array (new format) or needs subcollection fetch (old format)
      let products;

      if (firestoreOrder.products && Array.isArray(firestoreOrder.products)) {
        // NEW FORMAT: Products as array
        console.log('📱 Order uses new format (products array)');

        products = firestoreOrder.products.map((product, index) => ({
          id: buildLineItemId(product, index),
          stock: product.quantity,
          verified: 0,
          productSnapshot: product.productSnapshot,
          selectedVariants: product.selectedVariants,
          lineItemId: buildLineItemId(product, index),
          productData: product.productSnapshot
        }));
      } else {
        // OLD FORMAT: Products as subcollection
        console.log('📁 Order uses old format (products subcollection)');

        products = await getProductsByOrder(orderId);
      }

      console.log('✅ Found order in Firestore with products:', products);

      setIsLoading(false);
      return {
        order: firestoreOrder,
        products,
        source: 'firestore',
        format: firestoreOrder.products ? 'new' : 'old'
      };

    } catch (err) {
      console.error('❌ Error fetching order details:', err);
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  }, [getLocalOrder, getFirestoreOrder, getProductsByOrder]);

  return {
    getOrderWithProducts,
    isLoading,
    error
  };
}
