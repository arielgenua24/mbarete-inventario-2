/**
 * Sync Service - Firestore ↔ IndexedDB Synchronization
 *
 * Handles intelligent synchronization between Firestore (remote) and IndexedDB (local).
 * Uses timestamp-based delta sync to minimize data transfer.
 */

import { db as firestore } from '../firebaseSetUp';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

import {
  saveProducts,
  clearProducts,
  getMetadata,
  updateMetadata,
  setSyncStatus,
  getProductsCount
} from './cacheService';

import syncEvents from './syncEvents';

/**
 * Check if there are updates available from Firestore
 * Compares local and remote timestamps to decide sync strategy
 *
 * @returns {Promise<Object>} - { needsSync, syncType, remoteTimestamp, localTimestamp }
 */
export const checkForUpdates = async () => {
  try {
    console.log('🔍 Checking for updates...');

    // Get remote metadata
    const metadataRef = doc(firestore, 'metadata', 'catalog');
    const metadataSnap = await getDoc(metadataRef);

    if (!metadataSnap.exists()) {
      console.warn('⚠️ Remote metadata does not exist. Creating it...');
      // Metadata doesn't exist, need full sync
      return {
        needsSync: true,
        syncType: 'full',
        remoteTimestamp: null,
        localTimestamp: null,
        reason: 'Remote metadata missing'
      };
    }

    const remoteMetadata = metadataSnap.data();
    const remoteTimestamp = remoteMetadata.lastUpdated;

    // Get local metadata
    const localMetadata = await getMetadata();

    if (!localMetadata || !localMetadata.lastSynced) {
      console.log('📦 First sync - will download full catalog');
      return {
        needsSync: true,
        syncType: 'full',
        remoteTimestamp,
        localTimestamp: null,
        reason: 'First sync'
      };
    }

    const localTimestamp = new Date(localMetadata.lastSynced);

    // Compare timestamps
    const remoteDate = remoteTimestamp.toDate();
    const timeDiff = remoteDate - localTimestamp;
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

    console.log('📊 Sync comparison:');
    console.log('  Remote updated:', remoteDate.toISOString());
    console.log('  Local synced:', localTimestamp.toISOString());
    console.log('  Difference:', daysDiff.toFixed(2), 'days');

    // Decide sync type
    if (remoteDate <= localTimestamp) {
      console.log('✅ Already up to date');
      return {
        needsSync: false,
        syncType: 'none',
        remoteTimestamp,
        localTimestamp,
        reason: 'Already synced'
      };
    }

    // If very outdated (>7 days), do full sync
    if (daysDiff > 7) {
      console.log('🔄 Very outdated, will do full sync');
      return {
        needsSync: true,
        syncType: 'full',
        remoteTimestamp,
        localTimestamp,
        reason: 'More than 7 days outdated'
      };
    }

    // Otherwise, delta sync
    console.log('⚡ Changes detected, will do delta sync');
    return {
      needsSync: true,
      syncType: 'delta',
      remoteTimestamp,
      localTimestamp,
      reason: 'Changes since last sync'
    };
  } catch (error) {
    console.error('❌ Failed to check for updates:', error);
    throw error;
  }
};

/**
 * Full sync - Download all products from Firestore
 * Used on first sync or when very outdated
 *
 * @returns {Promise<Object>} - { success, productsDownloaded, duration }
 */
export const fullSync = async () => {
  const startTime = Date.now();
  console.log('🚀 Starting FULL SYNC...');

  try {
    // Set status to syncing
    await setSyncStatus('syncing');

    // Clear existing products
    await clearProducts();
    console.log('🗑️ Cleared existing local products');

    // Download all products in batches
    const BATCH_SIZE = 500;
    let allProducts = [];
    let lastDoc = null;
    let totalDownloaded = 0;

    while (true) {
      // Build query
      let q = query(
        collection(firestore, 'products'),
        orderBy('productCode'),
        limit(BATCH_SIZE)
      );

      if (lastDoc) {
        q = query(
          collection(firestore, 'products'),
          orderBy('productCode'),
          startAfter(lastDoc),
          limit(BATCH_SIZE)
        );
      }

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        break;
      }

      const batchProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      allProducts.push(...batchProducts);
      totalDownloaded += batchProducts.length;

      console.log(`📥 Downloaded ${totalDownloaded} products...`);

      // Save batch to IndexedDB
      await saveProducts(batchProducts);

      // If less than BATCH_SIZE, we're done
      if (snapshot.docs.length < BATCH_SIZE) {
        break;
      }

      // Set last document for pagination
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    // Update metadata
    await updateMetadata({
      lastSynced: new Date().toISOString(),
      totalProducts: totalDownloaded,
      syncStatus: 'synced',
      lastError: null
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ FULL SYNC complete! ${totalDownloaded} products in ${duration}s`);

    // Notify listeners that products updated
    syncEvents.notifyProductsUpdated(totalDownloaded);

    return {
      success: true,
      productsDownloaded: totalDownloaded,
      duration: parseFloat(duration),
      syncType: 'full'
    };
  } catch (error) {
    console.error('❌ Full sync failed:', error);
    await setSyncStatus('error', error.message);
    throw error;
  }
};

/**
 * Delta sync - Download only products that changed since last sync
 * More efficient for regular updates
 *
 * @param {Date|Timestamp} lastSyncTimestamp - Last successful sync time
 * @returns {Promise<Object>} - { success, productsUpdated, duration }
 */
export const deltaSync = async (lastSyncTimestamp) => {
  const startTime = Date.now();
  console.log('⚡ Starting DELTA SYNC...');
  console.log('📅 Syncing changes since:', lastSyncTimestamp);

  try {
    // Set status to syncing
    await setSyncStatus('syncing');

    // Convert to Firestore Timestamp if needed
    let timestampToUse;
    if (lastSyncTimestamp instanceof Date) {
      timestampToUse = Timestamp.fromDate(lastSyncTimestamp);
    } else if (typeof lastSyncTimestamp === 'string') {
      timestampToUse = Timestamp.fromDate(new Date(lastSyncTimestamp));
    } else {
      timestampToUse = lastSyncTimestamp;
    }

    // Query products updated after last sync
    const q = query(
      collection(firestore, 'products'),
      where('updatedAt', '>', timestampToUse),
      orderBy('updatedAt', 'asc'),
      limit(500)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('✅ No changes to sync');
      await setSyncStatus('synced');
      return {
        success: true,
        productsUpdated: 0,
        duration: 0,
        syncType: 'delta'
      };
    }

    console.log(`📥 Found ${snapshot.docs.length} changed products`);

    // Process changed products
    const changedProducts = [];
    const deletedProducts = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const product = { id: doc.id, ...data };

      if (data.isDeleted) {
        deletedProducts.push(doc.id);
      } else {
        changedProducts.push(product);
      }
    });

    // Save changed products to IndexedDB
    if (changedProducts.length > 0) {
      await saveProducts(changedProducts);
      console.log(`✅ Updated ${changedProducts.length} products in local DB`);
    }

    // TODO: Handle deleted products (will implement in cacheService)
    if (deletedProducts.length > 0) {
      console.log(`🗑️ ${deletedProducts.length} products marked as deleted`);
    }

    // Update metadata with current timestamp
    const localProductCount = await getProductsCount();
    await updateMetadata({
      lastSynced: new Date().toISOString(),
      totalProducts: localProductCount,
      syncStatus: 'synced',
      lastError: null
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ DELTA SYNC complete! ${snapshot.docs.length} changes in ${duration}s`);

    // Notify listeners that products updated
    syncEvents.notifyProductsUpdated(changedProducts.length);

    return {
      success: true,
      productsUpdated: snapshot.docs.length,
      changedProducts: changedProducts.length,
      deletedProducts: deletedProducts.length,
      duration: parseFloat(duration),
      syncType: 'delta'
    };
  } catch (error) {
    console.error('❌ Delta sync failed:', error);
    await setSyncStatus('error', error.message);
    throw error;
  }
};

/**
 * Smart sync - Two-way sync (upload pending changes + download updates)
 * This is the main function to call for syncing
 *
 * @returns {Promise<Object>} - Sync results
 */
export const smartSync = async () => {
  try {
    console.log('🧠 Running smart sync (two-way)...');

    const results = {
      uploadQueue: { processed: false },
      downloadSync: { processed: false }
    };

    // STEP 1: Process upload queue (pending orders, etc.)
    // This runs FIRST to upload local changes made offline
    const { getPendingSyncTasks } = await import('./cacheService');
    const pendingTasks = await getPendingSyncTasks();

    if (pendingTasks && pendingTasks.length > 0) {
      console.log(`📤 Found ${pendingTasks.length} pending tasks in upload queue`);

      // Import syncWorker to process queue
      const { forceProcessQueue } = await import('./syncWorker');
      await forceProcessQueue();

      results.uploadQueue = {
        processed: true,
        taskCount: pendingTasks.length
      };
    } else {
      console.log('✅ Upload queue empty');
      results.uploadQueue = { processed: true, taskCount: 0 };
    }

    // STEP 2: Check if we need to download updates from Firestore
    const checkResult = await checkForUpdates();

    if (!checkResult.needsSync) {
      console.log('✅ No download needed');
      results.downloadSync = {
        processed: true,
        skipped: true,
        reason: checkResult.reason
      };
      return {
        success: true,
        results
      };
    }

    // STEP 3: Perform appropriate download sync type
    let downloadResult;
    if (checkResult.syncType === 'full') {
      downloadResult = await fullSync();
    } else if (checkResult.syncType === 'delta') {
      downloadResult = await deltaSync(checkResult.localTimestamp);
    }

    results.downloadSync = {
      processed: true,
      ...downloadResult
    };

    return {
      success: true,
      results
    };
  } catch (error) {
    console.error('❌ Smart sync failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Sync a single pending order to Firestore
 * Will be implemented in Phase 4
 *
 * @param {string} orderId - Order ID to sync
 * @returns {Promise<boolean>}
 */
export const syncOrder = async (orderId) => {
  // TODO: Implement in Phase 4
  console.log('TODO: syncOrder not implemented yet (Phase 4)');
  return false;
};

/**
 * Get current sync status
 *
 * @returns {Promise<Object>}
 */
export const getSyncStatus = async () => {
  try {
    const metadata = await getMetadata();
    if (!metadata) {
      return {
        status: 'never_synced',
        lastSynced: null,
        totalProducts: 0
      };
    }

    // Always get real count from IndexedDB
    const actualCount = await getProductsCount();

    return {
      status: metadata.syncStatus,
      lastSynced: metadata.lastSynced,
      totalProducts: actualCount, // Use real count, not metadata count
      lastError: metadata.lastError
    };
  } catch (error) {
    console.error('❌ Failed to get sync status:', error);
    return {
      status: 'error',
      lastSynced: null,
      totalProducts: 0,
      lastError: error.message
    };
  }
};

/**
 * Fix metadata count mismatch
 * Recalculates and updates the totalProducts count
 *
 * @returns {Promise<Object>}
 */
export const fixMetadataCount = async () => {
  try {
    const actualCount = await getProductsCount();
    await updateMetadata({
      totalProducts: actualCount
    });
    console.log(`✅ Metadata fixed: ${actualCount} products`);
    return {
      success: true,
      totalProducts: actualCount
    };
  } catch (error) {
    console.error('❌ Failed to fix metadata:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Export all functions
export default {
  checkForUpdates,
  fullSync,
  deltaSync,
  smartSync,
  syncOrder,
  getSyncStatus,
  fixMetadataCount
};
