/**
 * useLocalOrders Hook - Optimistic Order Management
 *
 * Creates orders instantly in IndexedDB, then syncs to Firestore in background
 * Provides <100ms order creation for instant QR code generation
 */

import { useState, useCallback } from 'react';
import {
  savePendingOrder,
  getPendingOrders as getPendingOrdersFromDB,
  updatePendingOrder,
  addSyncTask,
  getProduct,
  reserveStock
} from '../../services/cacheService';
import syncEvents from '../../services/syncEvents';

const useLocalOrders = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Generate unique order ID
   * Format: ORD_YYYYMMDD_HHMMSS_RANDOM
   */
  const generateOrderId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();

    return `ORD_${year}${month}${day}_${hours}${minutes}${seconds}_${random}`;
  };

  /**
   * Validate stock locally before creating order
   * Prevents overselling by checking IndexedDB
   *
   * @param {Array} products - Cart products
   * @returns {Promise<Object>} - { valid, errors }
   */
  const validateStock = useCallback(async (products) => {
    const errors = [];

    // Aggregate total requested quantities per product ID
    // This is critical: same product with different variants (size/color) shares the same stock
    const aggregated = {};
    for (const cartItem of products) {
      const product = cartItem.product || cartItem.item;
      const id = product.id;
      if (!aggregated[id]) {
        aggregated[id] = { productName: product.name, totalRequested: 0 };
      }
      aggregated[id].totalRequested += Number(cartItem.quantity);
    }

    for (const [productId, { productName, totalRequested }] of Object.entries(aggregated)) {
      // Get current product from IndexedDB
      const currentProduct = await getProduct(productId);

      if (!currentProduct) {
        errors.push({
          productId,
          productName,
          error: 'Product not found in local database'
        });
        continue;
      }

      const availableStock = Number(currentProduct.stock);

      if (availableStock < totalRequested) {
        errors.push({
          productId,
          productName,
          requested: totalRequested,
          available: availableStock,
          error: `Stock insuficiente: hay ${availableStock} disponibles, pero se pidieron ${totalRequested} en total`
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }, []);

  /**
   * Create order optimistically (instant, <100ms)
   * Saves to IndexedDB and queues for background sync
   *
   * @param {Object} orderData - { customerName, phone, address }
   * @param {Array} products - Cart products
   * @returns {Promise<Object>} - { success, orderId, error }
   */
  const createOrder = useCallback(async (orderData, products) => {
    const startTime = performance.now();
    setIsCreating(true);
    setError(null);

    try {
      console.log('🚀 Creating optimistic order...');

      // Step 1: Validate stock (local check)
      const stockValidation = await validateStock(products);
      if (!stockValidation.valid) {
        const errorMsg = stockValidation.errors
          .map(e => `${e.productName}: ${e.error}`)
          .join(', ');
        throw new Error(`Falla en validación de stock: ${errorMsg}`);
      }

      // Step 2: Generate order ID and code
      const orderId = generateOrderId();
      const orderCode = orderId.slice(-8); // Use last 8 characters as order code
      const now = new Date().toISOString();

      // Step 3: Prepare order data with product snapshots AND stock deltas
      const orderProducts = products.map(cartItem => {
        const product = cartItem.product || cartItem.item;
        const variants = cartItem.selectedVariants || {
          size: null,
          color: null
        };
        const quantitySold = Number(cartItem.quantity);

        return {
          productId: product.id,
          productSnapshot: {
            name: product.name,
            price: product.price,
            productCode: product.productCode,
            imageUrl: product.imageUrl || null,
            category: product.category || null
          },
          quantity: quantitySold,
          selectedVariants: {
            size: variants.size || null,
            color: variants.color || null
          },
          subtotal: Number(product.price) * quantitySold,
          // CRITICAL: Store stock delta for atomic Firestore update
          stockDelta: -quantitySold // Negative = reduction
        };
      });

      const totalAmount = orderProducts.reduce((sum, item) => sum + item.subtotal, 0);

      const completeOrderData = {
        orderId,
        orderCode, // Final order code
        customerName: orderData.customerName,
        phone: orderData.phone,
        address: orderData.address,
        products: orderProducts,
        totalAmount,
        status: 'pending',
        createdAt: now,
        syncStatus: 'pending', // pending, syncing, synced, failed
        attempts: 0
      };

      // Step 4: Reserve stock locally (decrease stock in IndexedDB)
      const stockDeltas = orderProducts.map(p => ({
        productId: p.productId,
        delta: p.stockDelta // Negative value
      }));

      console.log(`📊 Reserving stock locally:`, stockDeltas);
      const reservationResult = await reserveStock(stockDeltas);

      if (!reservationResult.success) {
        throw new Error(`Stock reservation failed: ${reservationResult.error}`);
      }

      console.log(`✅ Stock reserved locally`);

      // Step 5: Save to IndexedDB pendingOrders
      await savePendingOrder(completeOrderData);
      console.log(`💾 Order saved to IndexedDB: ${orderId}`);

      // Step 6: Add to sync queue
      await addSyncTask({
        type: 'sync_order',
        payload: { orderId },
        priority: 1, // High priority
        status: 'pending',
        createdAt: now
      });
      console.log(`📋 Order added to sync queue: ${orderId}`);

      // Step 7: Notify listeners
      syncEvents.emit('order_created', { orderId, orderData: completeOrderData });

      const duration = performance.now() - startTime;
      console.log(`✅ Order created in ${duration.toFixed(2)}ms`);

      return {
        success: true,
        orderId,
        duration
      };
    } catch (err) {
      console.error('❌ Error creating order:', err);
      setError(err.message);
      return {
        success: false,
        error: err.message
      };
    } finally {
      setIsCreating(false);
    }
  }, [validateStock]);

  /**
   * Get all pending orders from IndexedDB
   *
   * @returns {Promise<Array>}
   */
  const getPendingOrders = useCallback(async () => {
    try {
      const orders = await getPendingOrdersFromDB();
      return orders;
    } catch (err) {
      console.error('❌ Error getting pending orders:', err);
      return [];
    }
  }, []);

  /**
   * Get order by ID from IndexedDB
   *
   * @param {string} orderId - Order ID
   * @returns {Promise<Object|null>}
   */
  const getOrderById = useCallback(async (orderId) => {
    try {
      const orders = await getPendingOrdersFromDB();
      const order = orders.find(o => o.orderId === orderId);
      return order || null;
    } catch (err) {
      console.error('❌ Error getting order:', err);
      return null;
    }
  }, []);

  /**
   * Force sync of a specific order
   * Useful for retrying failed syncs
   *
   * @param {string} orderId - Order ID
   * @returns {Promise<boolean>}
   */
  const syncOrder = useCallback(async (orderId) => {
    try {
      // Update order status to trigger sync
      await updatePendingOrder(orderId, {
        syncStatus: 'pending',
        lastSyncAttempt: new Date().toISOString()
      });

      // Add to sync queue again
      await addSyncTask({
        type: 'sync_order',
        payload: { orderId },
        priority: 1,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      console.log(`🔄 Order ${orderId} queued for sync`);
      return true;
    } catch (err) {
      console.error('❌ Error syncing order:', err);
      return false;
    }
  }, []);

  return {
    // State
    isCreating,
    error,

    // Actions
    createOrder,
    getPendingOrders,
    getOrderById,
    syncOrder,
    validateStock
  };
};

export default useLocalOrders;
