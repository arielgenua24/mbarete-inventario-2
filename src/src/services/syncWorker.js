/**
 * Sync Worker - Background Sync Queue Processing
 *
 * Processes queued sync tasks in the background:
 * - Handles pending orders that need to be synced to Firestore
 * - Processes sync queue with retry logic
 * - Respects network conditions and priority
 */

import {
  getPendingSyncTasks,
  updateSyncTask,
  getPendingOrders,
  updatePendingOrder
} from './cacheService';

import { db as firestore } from '../firebaseSetUp';
import {
  doc,
  collection,
  getDocs,
  writeBatch,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';

class SyncWorker {
  constructor() {
    this.isRunning = false;
    this._isProcessingQueue = false; // Mutex guard to prevent concurrent processQueue execution
    this.processingInterval = null;
    this.maxRetries = 3;
    this.retryDelays = [1000, 5000, 30000]; // 1s, 5s, 30s

    // Configuration
    this.PROCESSING_INTERVAL_MS = 10 * 1000; // Check queue every 10 seconds
    this.BATCH_SIZE = 5; // Process up to 5 tasks at once
  }

  /**
   * Start the background worker
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ SyncWorker already running');
      return;
    }

    console.log('🔧 Starting SyncWorker...');
    this.isRunning = true;

    // Process immediately on start
    this.processQueue();

    // Set up periodic processing
    this.processingInterval = setInterval(() => {
      if (navigator.onLine) {
        this.processQueue();
      }
    }, this.PROCESSING_INTERVAL_MS);

    console.log('✅ SyncWorker started');
  }

  /**
   * Stop the background worker
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('⏹️ Stopping SyncWorker...');
    this.isRunning = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    console.log('✅ SyncWorker stopped');
  }

  /**
   * Process sync queue
   * Main processing loop
   *
   * FIX: Mutex guard prevents concurrent execution.
   * Without this, both SyncWorker.start() interval and SyncScheduler's
   * forceProcessQueue() can trigger processQueue() simultaneously,
   * causing the same sync task to be processed twice (race condition).
   */
  async processQueue() {
    // GUARD: Prevent concurrent execution (Fix for race condition bug)
    if (this._isProcessingQueue) {
      console.log('⚙️ processQueue already running, skipping concurrent call');
      return;
    }

    if (!navigator.onLine) {
      console.log('📴 Offline, skipping queue processing');
      return;
    }

    this._isProcessingQueue = true;
    try {
      // Get pending tasks sorted by priority and nextRetryAt
      const tasks = await getPendingSyncTasks(this.BATCH_SIZE);

      if (tasks.length === 0) {
        return;
      }

      console.log(`📋 Processing ${tasks.length} sync tasks...`);

      // Process each task
      for (const task of tasks) {
        await this.processTask(task);
      }
    } catch (error) {
      console.error('❌ Error processing sync queue:', error);
    } finally {
      this._isProcessingQueue = false; // Always release the lock
    }
  }

  /**
   * Process a single sync task
   *
   * @param {Object} task - Sync task from queue
   */
  async processTask(task) {
    const { taskId, type, payload, attempts = 0 } = task;

    try {
      console.log(`🔄 Processing task ${taskId} (${type})`);

      // Update task status to processing
      await updateSyncTask(taskId, {
        status: 'processing',
        lastAttemptAt: new Date().toISOString()
      });

      // ✅ ADD TIMEOUT: If sync takes longer than 30 seconds, mark as failed
      const SYNC_TIMEOUT_MS = 30000; // 30 seconds

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Sync timeout: took longer than 30 seconds')), SYNC_TIMEOUT_MS);
      });

      let result;
      const syncPromise = (async () => {
        switch (type) {
          case 'sync_order':
            return await this.syncOrder(payload);
          case 'sync_product_update':
            return await this.syncProductUpdate(payload);
          default:
            console.warn(`Unknown task type: ${type}`);
            return { success: false, error: 'Unknown task type' };
        }
      })();

      // Race between sync and timeout
      result = await Promise.race([syncPromise, timeoutPromise]);

      if (result.success) {
        // Mark task as completed
        await updateSyncTask(taskId, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          result: result.data
        });
        console.log(`✅ Task ${taskId} completed`);
      } else {
        // Handle failure
        await this.handleTaskFailure(taskId, attempts, result.error);
      }
    } catch (error) {
      console.error(`❌ Error processing task ${taskId}:`, error);
      await this.handleTaskFailure(taskId, attempts, error.message);
    }
  }

  /**
   * Handle task failure with retry logic
   *
   * @param {string} taskId - Task ID
   * @param {number} attempts - Current attempt count
   * @param {string} error - Error message
   */
  async handleTaskFailure(taskId, attempts, error) {
    const newAttempts = attempts + 1;

    if (newAttempts >= this.maxRetries) {
      // Max retries reached, mark as failed
      await updateSyncTask(taskId, {
        status: 'failed',
        attempts: newAttempts,
        lastError: error,
        failedAt: new Date().toISOString()
      });
      console.error(`❌ Task ${taskId} failed after ${newAttempts} attempts`);
    } else {
      // Schedule retry
      const delay = this.retryDelays[newAttempts - 1] || 30000;
      const nextRetryAt = new Date(Date.now() + delay).toISOString();

      await updateSyncTask(taskId, {
        status: 'pending',
        attempts: newAttempts,
        lastError: error,
        nextRetryAt
      });
      console.log(`⏰ Task ${taskId} scheduled for retry in ${delay / 1000}s`);
    }
  }

  /**
   * Sync an order to Firestore
   *
   * @param {Object} payload - Order data
   * @returns {Promise<Object>} - { success, data?, error? }
   */
  async syncOrder(payload) {
    const orderId = payload?.orderId;

    try {
      if (!orderId) {
        return {
          success: false,
          error: 'Missing orderId in sync payload'
        };
      }

      // Get pending order from IndexedDB
      const pendingOrders = await getPendingOrders();
      const order = pendingOrders.find(o => o.orderId === orderId);

      if (!order) {
        return {
          success: false,
          error: 'Order not found in pending orders'
        };
      }

      console.log(`📤 Syncing order to Firestore with atomic stock updates:`, order);

      // FIX: Order existence check moved INSIDE the transaction (see below).
      // Previously, getDoc() was called outside the transaction, allowing two
      // concurrent calls to both see exists() === false and proceed to create
      // the order twice (race condition causing double stock reduction).
      const orderRef = doc(firestore, 'orders', orderId);

      // Use Firestore transaction for atomic stock updates
      const result = await runTransaction(firestore, async (transaction) => {
        // CRITICAL: Firestore requires ALL READS FIRST, then ALL WRITES
        // The order of operations in a transaction must be:
        // 1. All reads (transaction.get)
        // 2. All writes (transaction.set, transaction.update)

        // ============================================
        // PHASE 1: ALL READS FIRST
        // ============================================

        // Step 0: Check if order already exists (INSIDE transaction = atomic)
        // FIX: Using transaction.get() instead of getDoc() ensures this check
        // is atomic with the subsequent writes. If two concurrent calls reach
        // this point, Firestore's transaction system will retry/abort one of them.
        const orderSnap = await transaction.get(orderRef);
        if (orderSnap.exists()) {
          // Order was already synced (possibly by a concurrent call)
          return { alreadyExists: true, orderId };
        }

        // Step A: AGGREGATE stock deltas by productId
        // CRITICAL FIX: If the same product has multiple variants (size/color),
        // we need to SUM all their deltas before updating Firestore
        // Example: Product #018 with 2 variants (negro/L: -2, azul/S: -3) → total delta: -5
        const productDeltaMap = new Map();

        for (const product of order.products) {
          const rawProductId = product?.productId;
          const productId = String(rawProductId ?? '').trim();
          const delta = Number(product?.stockDelta);

          if (!productId) {
            console.warn('⚠️ Skipping product without valid productId:', product);
            continue;
          }

          if (!Number.isFinite(delta) || delta === 0) {
            console.warn(`⚠️ Skipping invalid stockDelta for ${productId}:`, product?.stockDelta);
            continue;
          }

          if (String(rawProductId) !== productId) {
            console.log(`🧹 Normalized productId "${rawProductId}" -> "${productId}"`);
          }

          if (productDeltaMap.has(productId)) {
            // Product already exists, ADD the delta
            const existing = productDeltaMap.get(productId);
            existing.delta += delta;
            console.log(`📊 Aggregating delta for ${product.productSnapshot.name}: ${existing.delta}`);
          } else {
            // First time seeing this product, create entry
            productDeltaMap.set(productId, {
              productId,
              productRef: doc(firestore, 'products', productId),
              delta,
              name: product.productSnapshot.name
            });
          }
        }

        // Convert map to array for processing
        const productsToUpdate = Array.from(productDeltaMap.values());

        console.log(`📦 Products to update: ${productsToUpdate.length}`);
        productsToUpdate.forEach(p => {
          console.log(`   - ${p.name} (${p.productId}): delta = ${p.delta}`);
        });

        // Step B: READ ALL products first (Firestore transaction requirement)
        const productSnapshots = [];
        for (const productToUpdate of productsToUpdate) {
          const productSnap = await transaction.get(productToUpdate.productRef);
          productSnapshots.push({
            snap: productSnap,
            productData: productToUpdate
          });
        }

        // Step C: Validate stocks (no reads or writes, just validation)
        for (const { snap, productData } of productSnapshots) {
          if (!snap.exists()) {
            console.error(`❌ Product ${productData.productId} does not exist in Firestore!`);
            throw new Error(`Cannot apply stock delta: Product ${productData.name} not found in Firestore`);
          }

          const currentStock = Number(snap.data().stock) || 0;
          const delta = Number(productData.delta);
          const projectedStock = currentStock + delta;

          console.log(`📊 Stock validation for ${productData.name}:`);
          console.log(`   Firestore current: ${currentStock}`);
          console.log(`   Delta to apply: ${delta}`);
          console.log(`   Projected stock: ${projectedStock}`);

          if (projectedStock < 0) {
            console.error(`❌ Stock would go negative for ${productData.name}: ${currentStock} + ${delta} = ${projectedStock}`);
            throw new Error(`Insufficient stock in Firestore for ${productData.name}`);
          }
        }

        // ============================================
        // PHASE 2: ALL WRITES AFTER ALL READS
        // ============================================

        // Step D: Create order in Firestore (WRITE)
        const firestoreOrderData = {
          // New format
          orderCode: order.orderCode,
          customerName: order.customerName,
          phone: order.phone,
          address: order.address,
          products: order.products,
          totalAmount: order.totalAmount,
          status: order.status,
          createdAt: serverTimestamp(),
          syncedAt: serverTimestamp(),

          // Legacy fields for backwards compatibility with old UI
          cliente: order.customerName,
          telefono: order.phone,
          direccion: order.address,
          estado: order.status,
          // fecha will be set after transaction (can't use serverTimestamp in client format)
        };

        transaction.set(orderRef, firestoreOrderData);

        // Step E: WRITE ALL stock updates using the projected stock calculated in JS
        for (const { snap, productData } of productSnapshots) {
          const currentStock = Number(snap.data().stock) || 0;
          const delta = Number(productData.delta);
          const projectedStock = currentStock + delta;

          transaction.update(productData.productRef, {
            stock: projectedStock,
            updatedAt: serverTimestamp()
          });

          console.log(`✅ Stock update: ${currentStock} → ${projectedStock} (delta: ${delta})`);
        }

        return { orderId, alreadyExists: false };
      });

      // Handle the "already exists" case after the transaction
      // FIX: Even if the order exists, the products subcollection might be missing
      // (e.g., if the batch write failed on a previous attempt)
      if (result.alreadyExists) {
        await this.ensureProductsSubcollection(orderId, order.products);
        await updatePendingOrder(orderId, { syncStatus: 'synced' });
        console.log(`✅ Order ${orderId} already exists in Firestore (detected inside transaction)`);
        return {
          success: true,
          data: { message: 'Order already exists in Firestore' }
        };
      }

      // Update order with formatted fecha (for backwards compatibility)
      const now = new Date();
      const formattedFecha = now.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      await writeBatch(firestore)
        .update(orderRef, { fecha: formattedFecha })
        .commit();

      // Create products subcollection (for backwards compatibility with ProductsVerification)
      await this.ensureProductsSubcollection(orderId, order.products);

      // Update metadata catalog (products were updated)
      const metadataRef = doc(firestore, 'metadata', 'catalog');
      await writeBatch(firestore)
        .set(metadataRef, { lastUpdated: serverTimestamp() }, { merge: true })
        .commit();

      // Update pending order status
      await updatePendingOrder(orderId, {
        syncStatus: 'synced',
        syncedAt: new Date().toISOString()
      });

      console.log(`✅ Order ${orderId} synced to Firestore with atomic stock updates`);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('❌ Failed to sync order:', error);

      // ✅ Mark order as failed in IndexedDB so UI can show error
      await updatePendingOrder(orderId, {
        syncStatus: 'failed',
        lastError: error.message,
        failedAt: new Date().toISOString()
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Ensures the products subcollection exists for an order.
   * Uses deterministic IDs so the operation is idempotent (safe to retry).
   *
   * @param {string} orderId - The order ID
   * @param {Array} products - The products array from the order
   */
  async ensureProductsSubcollection(orderId, products) {
    const productsCollRef = collection(firestore, 'orders', orderId, 'products');
    const existingDocs = await getDocs(productsCollRef);

    if (existingDocs.size > 0) {
      console.log(`📦 Products subcollection already exists for ${orderId} (${existingDocs.size} docs)`);
      return;
    }

    console.log(`📦 Creating products subcollection for ${orderId}...`);
    const batch = writeBatch(firestore);

    for (const [index, product] of products.entries()) {
      const deterministicId = `${product.productId}_${index}`;
      const productDocRef = doc(firestore, 'orders', orderId, 'products', deterministicId);

      batch.set(productDocRef, {
        productSnapshot: product.productSnapshot,
        stock: product.quantity,
        verified: 0,
        selectedVariants: product.selectedVariants,
        createdAt: serverTimestamp(),
        productId: product.productId
      });
    }

    await batch.commit();
    console.log(`✅ Created ${products.length} product documents in subcollection for ${orderId}`);
  }

  /**
   * Sync a product update to Firestore
   * (For future use when products can be edited offline)
   *
   * @param {Object} payload - Product update data
   * @returns {Promise<Object>} - { success, data?, error? }
   */
  async syncProductUpdate(payload) {
    try {
      const { productId, updates } = payload;

      const productRef = doc(firestore, 'products', productId);
      const batch = writeBatch(firestore);

      batch.update(productRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });

      // Update catalog metadata
      const metadataRef = doc(firestore, 'metadata', 'catalog');
      batch.set(
        metadataRef,
        { lastUpdated: serverTimestamp() },
        { merge: true }
      );

      await batch.commit();

      console.log(`✅ Product ${productId} update synced to Firestore`);

      return {
        success: true,
        data: { productId }
      };
    } catch (error) {
      console.error('❌ Failed to sync product update:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get worker status
   *
   * @returns {Object} - Current worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      processingInterval: this.PROCESSING_INTERVAL_MS,
      maxRetries: this.maxRetries
    };
  }

  /**
   * Force immediate queue processing
   */
  async forceProcess() {
    if (!navigator.onLine) {
      console.log('📴 Cannot force process: offline');
      return {
        success: false,
        error: 'Device is offline'
      };
    }

    console.log('🚀 Force processing sync queue');
    await this.processQueue();
    return { success: true };
  }
}

// Create singleton instance
const syncWorker = new SyncWorker();

// Export singleton
export default syncWorker;
export { SyncWorker };

/**
 * Start the sync worker
 */
export const startSyncWorker = () => {
  syncWorker.start();
};

/**
 * Stop the sync worker
 */
export const stopSyncWorker = () => {
  syncWorker.stop();
};

/**
 * Get worker status
 */
export const getWorkerStatus = () => {
  return syncWorker.getStatus();
};

/**
 * Force immediate processing
 */
export const forceProcessQueue = async () => {
  return await syncWorker.forceProcess();
};
