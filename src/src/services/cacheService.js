/**
 * Cache Service - IndexedDB CRUD Operations
 *
 * This service handles all IndexedDB operations for local data storage.
 * It provides a clean API for products, orders, and metadata management.
 */

import { db } from '../db/indexedDB';

/**
 * ==========================================
 * PRODUCT OPERATIONS
 * ==========================================
 */

/**
 * Save multiple products to IndexedDB (bulk operation)
 * Used during full sync and delta sync
 *
 * @param {Array} products - Array of product objects
 * @returns {Promise<number>} - Number of products saved
 */
export const saveProducts = async (products) => {
  try {
    if (!Array.isArray(products) || products.length === 0) {
      console.warn('No products to save');
      return 0;
    }

    // Use bulkPut for better performance (upsert operation)
    await db.products.bulkPut(products);

    console.log(`✅ Saved ${products.length} products to IndexedDB`);
    return products.length;
  } catch (error) {
    console.error('❌ Failed to save products:', error);
    throw error;
  }
};

/**
 * Get a single product by ID
 *
 * @param {string} id - Product ID
 * @returns {Promise<Object|null>} - Product object or null if not found
 */
export const getProduct = async (id) => {
  try {
    const product = await db.products.get(id);
    return product || null;
  } catch (error) {
    console.error('❌ Failed to get product:', error);
    return null;
  }
};

/**
 * Get all products from IndexedDB
 * Used for initial load or full catalog display
 *
 * @param {number} limit - Optional limit (default: all)
 * @returns {Promise<Array>} - Array of products
 */
export const getAllProducts = async (limit = null) => {
  try {
    let query = db.products.orderBy('name');

    if (limit) {
      query = query.limit(limit);
    }

    const products = await query.toArray();
    return products;
  } catch (error) {
    console.error('❌ Failed to get all products:', error);
    return [];
  }
};

/**
 * Search products by name or product code
 * Ultra-fast local search (< 50ms target)
 *
 * @param {string} term - Search term
 * @param {number} limit - Max results (default: 20)
 * @returns {Promise<Array>} - Array of matching products
 */
export const searchProducts = async (term, limit = 20) => {
  try {
    if (!term || term.trim() === '') {
      return [];
    }

    const searchTerm = term.toLowerCase().trim();
    const codeSearchTerms = [searchTerm];

    // Allow searching codes with or without "#" (e.g. "011" or "#011")
    if (!searchTerm.startsWith('#')) {
      codeSearchTerms.push(`#${searchTerm}`);
    }

    const [nameResults, ...codeResultsByTerm] = await Promise.all([
      // Search by name (case-insensitive)
      db.products
        .where('name')
        .startsWithIgnoreCase(searchTerm)
        .limit(limit)
        .toArray(),

      // Search by product code (case-insensitive)
      ...codeSearchTerms.map((codeTerm) =>
        db.products
          .where('productCode')
          .startsWithIgnoreCase(codeTerm)
          .limit(limit)
          .toArray()
      )
    ]);

    const codeResults = codeResultsByTerm.flat();

    // Combine and deduplicate results
    const combinedResults = [...nameResults, ...codeResults];
    const uniqueResults = Array.from(
      new Map(combinedResults.map(p => [p.id, p])).values()
    );

    // Sort by popularity if available (optional)
    const sorted = uniqueResults.sort((a, b) => {
      const scoreA = a.salesStats?.popularityScore || 0;
      const scoreB = b.salesStats?.popularityScore || 0;
      return scoreB - scoreA;
    });

    return sorted.slice(0, limit);
  } catch (error) {
    console.error('❌ Failed to search products:', error);
    return [];
  }
};

/**
 * Update a single product
 *
 * @param {string} id - Product ID
 * @param {Object} data - Updated product data
 * @returns {Promise<boolean>} - true if updated successfully
 */
export const updateProduct = async (id, data) => {
  try {
    await db.products.update(id, data);
    console.log(`✅ Updated product ${id}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to update product:', error);
    return false;
  }
};

/**
 * Apply stock delta to a product (increment/decrement)
 * Used for reserving stock when creating orders
 *
 * @param {string} id - Product ID
 * @param {number} delta - Amount to change (negative = decrease, positive = increase)
 * @returns {Promise<Object>} - { success, newStock?, error? }
 */
export const applyStockDelta = async (id, delta) => {
  try {
    const product = await db.products.get(id);

    if (!product) {
      return {
        success: false,
        error: 'Product not found'
      };
    }

    const deltaNumber = Number(delta);
    if (!Number.isFinite(deltaNumber)) {
      return {
        success: false,
        error: `Invalid delta value: ${delta}`
      };
    }

    const currentStock = Number(product.stock) || 0;
    const newStock = currentStock + deltaNumber;

    if (newStock < 0) {
      return {
        success: false,
        error: `Cannot apply delta ${deltaNumber}. Current stock: ${currentStock}`,
        currentStock
      };
    }

    await db.products.update(id, { stock: newStock });
    console.log(`📊 Stock updated for ${product.name}: ${currentStock} → ${newStock} (delta: ${deltaNumber})`);

    return {
      success: true,
      newStock,
      previousStock: currentStock
    };
  } catch (error) {
    console.error('❌ Failed to apply stock delta:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Reserve stock for multiple products (decrease stock locally)
 * Used when creating orders offline
 *
 * @param {Array} stockDeltas - Array of { productId, delta }
 * @returns {Promise<Object>} - { success, results, error? }
 */
export const reserveStock = async (stockDeltas) => {
  try {
    const results = [];

    for (const { productId, delta } of stockDeltas) {
      const deltaNumber = Number(delta);
      const result = await applyStockDelta(productId, deltaNumber);
      results.push({ productId, delta: deltaNumber, ...result });

      if (!result.success) {
        // Rollback previous changes
        console.warn(`⚠️ Failed to reserve stock for ${productId}, rolling back...`);
        for (const prevResult of results.slice(0, -1)) {
          if (prevResult.success) {
            // Reverse the delta
            await applyStockDelta(prevResult.productId, -prevResult.delta);
          }
        }
        return {
          success: false,
          error: `Stock reservation failed for product ${productId}`,
          results
        };
      }
    }

    return {
      success: true,
      results
    };
  } catch (error) {
    console.error('❌ Failed to reserve stock:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete a single product
 *
 * @param {string} id - Product ID
 * @returns {Promise<boolean>} - true if deleted successfully
 */
export const deleteProduct = async (id) => {
  try {
    await db.products.delete(id);
    console.log(`✅ Deleted product ${id}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to delete product:', error);
    return false;
  }
};

/**
 * Clear all products (used before full sync)
 *
 * @returns {Promise<boolean>}
 */
export const clearProducts = async () => {
  try {
    await db.products.clear();
    console.log('✅ Cleared all products from IndexedDB');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear products:', error);
    return false;
  }
};

/**
 * Get products count
 *
 * @returns {Promise<number>}
 */
export const getProductsCount = async () => {
  try {
    return await db.products.count();
  } catch (error) {
    console.error('❌ Failed to get products count:', error);
    return 0;
  }
};

/**
 * ==========================================
 * METADATA OPERATIONS
 * ==========================================
 */

/**
 * Get catalog metadata
 *
 * @returns {Promise<Object|null>}
 */
export const getMetadata = async () => {
  try {
    const metadata = await db.catalogMetadata.get('local');
    return metadata || null;
  } catch (error) {
    console.error('❌ Failed to get metadata:', error);
    return null;
  }
};

/**
 * Update catalog metadata
 *
 * @param {Object} data - Metadata to update
 * @returns {Promise<boolean>}
 */
export const updateMetadata = async (data) => {
  try {
    await db.catalogMetadata.update('local', {
      ...data,
      updatedAt: new Date().toISOString()
    });
    console.log('✅ Updated metadata');
    return true;
  } catch (error) {
    console.error('❌ Failed to update metadata:', error);
    return false;
  }
};

/**
 * Set sync status
 *
 * @param {string} status - 'never_synced' | 'syncing' | 'synced' | 'stale' | 'error'
 * @param {string} error - Optional error message
 * @returns {Promise<boolean>}
 */
export const setSyncStatus = async (status, error = null) => {
  try {
    await db.catalogMetadata.update('local', {
      syncStatus: status,
      lastError: error,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.error('❌ Failed to set sync status:', err);
    return false;
  }
};

/**
 * ==========================================
 * PENDING ORDERS OPERATIONS
 * ==========================================
 */

/**
 * Save a pending order
 *
 * @param {Object} order - Order object
 * @returns {Promise<boolean>}
 */
export const savePendingOrder = async (order) => {
  try {
    await db.pendingOrders.put(order);
    console.log(`✅ Saved pending order ${order.orderId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to save pending order:', error);
    return false;
  }
};

/**
 * Get all pending orders
 *
 * @param {string} statusFilter - Optional status filter
 * @returns {Promise<Array>}
 */
export const getPendingOrders = async (statusFilter = null) => {
  try {
    let query = db.pendingOrders.orderBy('createdAt').reverse();

    if (statusFilter) {
      query = db.pendingOrders.where('status').equals(statusFilter);
    }

    return await query.toArray();
  } catch (error) {
    console.error('❌ Failed to get pending orders:', error);
    return [];
  }
};

/**
 * Get a single pending order
 *
 * @param {string} orderId - Order ID
 * @returns {Promise<Object|null>}
 */
export const getPendingOrder = async (orderId) => {
  try {
    const order = await db.pendingOrders.get(orderId);
    return order || null;
  } catch (error) {
    console.error('❌ Failed to get pending order:', error);
    return null;
  }
};

/**
 * Update pending order status
 *
 * @param {string} orderId - Order ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<boolean>}
 */
export const updatePendingOrder = async (orderId, updates) => {
  try {
    await db.pendingOrders.update(orderId, updates);
    console.log(`✅ Updated pending order ${orderId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to update pending order:', error);
    return false;
  }
};

/**
 * Delete a pending order
 *
 * @param {string} orderId - Order ID
 * @returns {Promise<boolean>}
 */
export const deletePendingOrder = async (orderId) => {
  try {
    await db.pendingOrders.delete(orderId);
    console.log(`✅ Deleted pending order ${orderId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to delete pending order:', error);
    return false;
  }
};

/**
 * ==========================================
 * SYNC QUEUE OPERATIONS
 * ==========================================
 */

/**
 * Add task to sync queue
 *
 * @param {Object} task - Task object
 * @returns {Promise<boolean>}
 */
export const addSyncTask = async (task) => {
  try {
    // Generate taskId if not provided
    if (!task.taskId) {
      task.taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    await db.syncQueue.put(task);
    console.log(`✅ Added sync task ${task.taskId} (${task.type})`);
    return true;
  } catch (error) {
    console.error('❌ Failed to add sync task:', error);
    return false;
  }
};

/**
 * Get pending sync tasks (ordered by priority)
 *
 * @param {number} limit - Maximum number of tasks to return
 * @returns {Promise<Array>}
 */
export const getPendingSyncTasks = async (limit = 10) => {
  try {
    const now = new Date().toISOString();

    // Get tasks that are pending or failed, and ready to retry
    const tasks = await db.syncQueue
      .where('status')
      .anyOf(['pending', 'failed'])
      .and(task => !task.nextRetryAt || task.nextRetryAt <= now)
      .limit(limit)
      .sortBy('priority');

    return tasks.reverse(); // Higher priority first
  } catch (error) {
    console.error('❌ Failed to get pending sync tasks:', error);
    return [];
  }
};

/**
 * Update sync task
 *
 * @param {string} taskId - Task ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<boolean>}
 */
export const updateSyncTask = async (taskId, updates) => {
  try {
    await db.syncQueue.update(taskId, updates);
    return true;
  } catch (error) {
    console.error('❌ Failed to update sync task:', error);
    return false;
  }
};

/**
 * Delete sync task
 *
 * @param {string} taskId - Task ID
 * @returns {Promise<boolean>}
 */
export const deleteSyncTask = async (taskId) => {
  try {
    await db.syncQueue.delete(taskId);
    return true;
  } catch (error) {
    console.error('❌ Failed to delete sync task:', error);
    return false;
  }
};

/**
 * ==========================================
 * ORDER HISTORY OPERATIONS (Optional)
 * ==========================================
 */

/**
 * Save order to history
 *
 * @param {Object} order - Order object
 * @returns {Promise<boolean>}
 */
export const saveOrderHistory = async (order) => {
  try {
    await db.orderHistory.put(order);
    console.log(`✅ Saved order ${order.orderId} to history`);
    return true;
  } catch (error) {
    console.error('❌ Failed to save order history:', error);
    return false;
  }
};

/**
 * Get order history
 *
 * @param {number} limit - Max results
 * @returns {Promise<Array>}
 */
export const getOrderHistory = async (limit = 50) => {
  try {
    return await db.orderHistory
      .orderBy('createdAt')
      .reverse()
      .limit(limit)
      .toArray();
  } catch (error) {
    console.error('❌ Failed to get order history:', error);
    return [];
  }
};

/**
 * ==========================================
 * UTILITY FUNCTIONS
 * ==========================================
 */

/**
 * Get storage usage estimate
 *
 * @returns {Promise<Object>}
 */
export const getStorageUsage = async () => {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        percentage: ((estimate.usage / estimate.quota) * 100).toFixed(2),
        usageMB: (estimate.usage / (1024 * 1024)).toFixed(2),
        quotaMB: (estimate.quota / (1024 * 1024)).toFixed(2)
      };
    }
    return null;
  } catch (error) {
    console.error('❌ Failed to get storage usage:', error);
    return null;
  }
};

// Export all functions
export default {
  // Products
  saveProducts,
  getProduct,
  getAllProducts,
  searchProducts,
  updateProduct,
  deleteProduct,
  clearProducts,
  getProductsCount,

  // Metadata
  getMetadata,
  updateMetadata,
  setSyncStatus,

  // Pending Orders
  savePendingOrder,
  getPendingOrders,
  getPendingOrder,
  updatePendingOrder,
  deletePendingOrder,

  // Sync Queue
  addSyncTask,
  getPendingSyncTasks,
  updateSyncTask,
  deleteSyncTask,

  // Order History
  saveOrderHistory,
  getOrderHistory,

  // Utilities
  getStorageUsage
};
