/**
 * IndexedDB Configuration with Dexie
 *
 * Database: reina-chura-db
 * Version: 1
 *
 * This is the offline-first storage layer for the application.
 * All data is stored locally and synced with Firestore in the background.
 */

import Dexie from 'dexie';

/**
 * Database Schema
 *
 * Stores:
 * 1. products - Complete product catalog with prices, stock, images
 * 2. catalogMetadata - Sync metadata (last sync timestamp, status)
 * 3. pendingOrders - Orders waiting to be synced to Firestore
 * 4. syncQueue - Queue of sync tasks with retry logic
 * 5. orderHistory - Local copy of orders for offline access (optional)
 */
class ReinaChuraDatabase extends Dexie {
  constructor() {
    super('reina-chura-db');

    // Define database version and schema
    this.version(1).stores({
      // Products store - main catalog
      // Key: id (product ID from Firestore)
      // Indices: name (for search), productCode (for search), updatedAt (for delta sync)
      products: 'id, name, productCode, updatedAt, category',

      // Catalog metadata - single document for sync tracking
      // Key: id (always 'local')
      catalogMetadata: 'id',

      // Pending orders - orders not yet synced to Firestore
      // Key: orderId (generated locally)
      // Indices: createdAt (for sorting), status (for filtering), attempts (for retry logic)
      pendingOrders: 'orderId, createdAt, status, attempts',

      // Sync queue - tasks to be processed by background worker
      // Key: taskId (generated locally)
      // Indices: priority (for ordering), status (for filtering), nextRetryAt (for retry timing)
      syncQueue: 'taskId, priority, status, nextRetryAt',

      // Order history - local copy of synced orders (optional, for offline reports)
      // Key: orderId (from Firestore)
      // Indices: createdAt (for sorting), customerName (for search)
      orderHistory: 'orderId, createdAt, customerName'
    });

    // Define table references with TypeScript-like typing (for better IDE support)
    this.products = this.table('products');
    this.catalogMetadata = this.table('catalogMetadata');
    this.pendingOrders = this.table('pendingOrders');
    this.syncQueue = this.table('syncQueue');
    this.orderHistory = this.table('orderHistory');
  }
}

// Create singleton instance
export const db = new ReinaChuraDatabase();

/**
 * Initialize the database
 * Call this when the app starts
 *
 * @returns {Promise<boolean>} - true if initialized successfully
 */
export const initializeDB = async () => {
  try {
    // Database will auto-open on first access, no need to explicitly open
    // Just verify it's accessible and create metadata if needed

    // Check if metadata exists, if not create initial entry
    const metadata = await db.catalogMetadata.get('local');
    if (!metadata) {
      await db.catalogMetadata.add({
        id: 'local',
        lastSynced: null,
        totalProducts: 0,
        syncStatus: 'never_synced', // 'never_synced' | 'syncing' | 'synced' | 'stale' | 'error'
        lastError: null,
        createdAt: new Date().toISOString()
      });
      console.log('✅ IndexedDB initialized with initial metadata');
    } else {
      console.log('✅ IndexedDB already initialized');
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize IndexedDB:', error);

    // Handle quota exceeded error
    if (error.name === 'QuotaExceededError') {
      console.error('💾 Storage quota exceeded. Please free up space.');
    }

    return false;
  }
};

/**
 * Clear all data from the database
 * Useful for debugging or complete reset
 *
 * @returns {Promise<void>}
 */
export const clearAllData = async () => {
  try {
    await db.products.clear();
    await db.catalogMetadata.clear();
    await db.pendingOrders.clear();
    await db.syncQueue.clear();
    await db.orderHistory.clear();

    console.log('✅ All data cleared from IndexedDB');

    // Recreate initial metadata
    await db.catalogMetadata.add({
      id: 'local',
      lastSynced: null,
      totalProducts: 0,
      syncStatus: 'never_synced',
      lastError: null,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to clear data:', error);
    throw error;
  }
};

/**
 * Get database statistics
 * Useful for debugging and monitoring
 *
 * @returns {Promise<Object>}
 */
export const getDBStats = async () => {
  try {
    const [
      productsCount,
      pendingOrdersCount,
      syncQueueCount,
      orderHistoryCount,
      metadata
    ] = await Promise.all([
      db.products.count(),
      db.pendingOrders.count(),
      db.syncQueue.count(),
      db.orderHistory.count(),
      db.catalogMetadata.get('local')
    ]);

    return {
      products: productsCount,
      pendingOrders: pendingOrdersCount,
      syncQueue: syncQueueCount,
      orderHistory: orderHistoryCount,
      metadata,
      lastSynced: metadata?.lastSynced,
      syncStatus: metadata?.syncStatus
    };
  } catch (error) {
    console.error('❌ Failed to get DB stats:', error);
    return null;
  }
};

/**
 * Check if database is ready
 *
 * @returns {boolean}
 */
export const isDBReady = () => {
  return db.isOpen();
};

// Export default instance
export default db;
