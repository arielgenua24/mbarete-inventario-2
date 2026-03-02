/**
 * Sync Scheduler - Automatic Sync Triggers
 *
 * Manages automatic synchronization based on various triggers:
 * - App startup
 * - Periodic intervals (every 5 minutes when online)
 * - Network reconnection
 * - App visibility changes
 */

import { smartSync } from './syncService';
import { getMetadata } from './cacheService';

class SyncScheduler {
  constructor() {
    this.isInitialized = false;
    this.syncInterval = null;
    this.isSyncing = false;
    this.lastSyncAttempt = null;
    this.syncCallbacks = new Set();

    // Configuration
    this.SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    this.MIN_SYNC_GAP_MS = 30 * 1000; // Minimum 30 seconds between syncs
  }

  /**
   * Initialize the scheduler
   * Sets up all event listeners and triggers initial sync
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ SyncScheduler already initialized');
      return;
    }

    console.log('🔧 Initializing SyncScheduler...');

    // Set up event listeners
    this.setupEventListeners();

    // Trigger initial sync (after a short delay to not block app startup)
    setTimeout(() => {
      this.triggerSync('app_startup');
    }, 2000);

    // Start periodic sync if online
    if (navigator.onLine) {
      this.startPeriodicSync();
    }

    this.isInitialized = true;
    console.log('✅ SyncScheduler initialized');
  }

  /**
   * Set up event listeners for automatic sync triggers
   */
  setupEventListeners() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('🌐 Network connection restored');
      this.handleOnline();
    });

    window.addEventListener('offline', () => {
      console.log('📴 Network connection lost');
      this.handleOffline();
    });

    // Listen for visibility changes (tab becomes visible)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('👁️ App became visible');
        this.handleVisibilityChange();
      }
    });

    // Listen for focus events (window gains focus)
    window.addEventListener('focus', () => {
      console.log('🎯 App gained focus');
      this.handleFocus();
    });

    console.log('📡 Event listeners set up');
  }

  /**
   * Handle online event
   * Triggers sync when connection is restored
   */
  async handleOnline() {
    console.log('🔄 Handling online event');
    this.startPeriodicSync();
    await this.triggerSync('network_restored');
  }

  /**
   * Handle offline event
   * Stops periodic sync
   */
  handleOffline() {
    console.log('⏸️ Handling offline event');
    this.stopPeriodicSync();
  }

  /**
   * Handle visibility change
   * Triggers sync when app becomes visible after being hidden
   */
  async handleVisibilityChange() {
    if (navigator.onLine) {
      await this.triggerSync('visibility_change');
    }
  }

  /**
   * Handle focus event
   * Triggers sync when app gains focus (less aggressive than visibility)
   */
  async handleFocus() {
    // Only sync if it's been a while since last sync
    if (this.shouldSync()) {
      await this.triggerSync('app_focus');
    }
  }

  /**
   * Start periodic sync interval
   */
  startPeriodicSync() {
    if (this.syncInterval) {
      console.log('⏰ Periodic sync already running');
      return;
    }

    console.log(`⏰ Starting periodic sync (every ${this.SYNC_INTERVAL_MS / 1000}s)`);

    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !document.hidden) {
        this.triggerSync('periodic');
      }
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Stop periodic sync interval
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      console.log('⏸️ Stopping periodic sync');
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Check if sync should be triggered
   * Prevents too frequent syncs
   */
  shouldSync() {
    if (!navigator.onLine) {
      return false;
    }

    if (this.isSyncing) {
      return false;
    }

    if (!this.lastSyncAttempt) {
      return true;
    }

    const timeSinceLastSync = Date.now() - this.lastSyncAttempt;
    return timeSinceLastSync >= this.MIN_SYNC_GAP_MS;
  }

  /**
   * Trigger sync with rate limiting
   *
   * @param {string} reason - Reason for sync (for logging)
   * @returns {Promise<Object|null>} - Sync result or null if skipped
   */
  async triggerSync(reason = 'manual') {
    if (!this.shouldSync()) {
      console.log(`⏭️ Skipping sync (${reason}): too soon or already syncing`);
      return null;
    }

    try {
      console.log(`🔄 Triggering sync (${reason})`);
      this.isSyncing = true;
      this.lastSyncAttempt = Date.now();

      // Call sync callbacks before sync
      this.notifyCallbacks('sync_start', { reason });

      const result = await smartSync();

      // Call sync callbacks after sync
      this.notifyCallbacks('sync_complete', { reason, result });

      if (result.success) {
        if (result.skipped) {
          console.log(`✅ Sync completed (${reason}): Already up to date`);
        } else {
          console.log(`✅ Sync completed (${reason}):`, result);
        }
      } else {
        console.error(`❌ Sync failed (${reason}):`, result.error);
      }

      return result;
    } catch (error) {
      console.error(`❌ Sync error (${reason}):`, error);
      this.notifyCallbacks('sync_error', { reason, error: error.message });
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Register callback for sync events
   *
   * @param {Function} callback - Callback function(event, data)
   */
  onSyncEvent(callback) {
    this.syncCallbacks.add(callback);
    return () => this.syncCallbacks.delete(callback);
  }

  /**
   * Notify all registered callbacks
   *
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  notifyCallbacks(event, data) {
    this.syncCallbacks.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in sync callback:', error);
      }
    });
  }

  /**
   * Force an immediate sync (bypasses rate limiting)
   *
   * @returns {Promise<Object>}
   */
  async forceSync() {
    console.log('🚀 Force sync requested');
    this.lastSyncAttempt = null; // Reset rate limit
    return await this.triggerSync('force_manual');
  }

  /**
   * Get scheduler status
   *
   * @returns {Object} - Current scheduler status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isSyncing: this.isSyncing,
      isOnline: navigator.onLine,
      periodicSyncActive: !!this.syncInterval,
      lastSyncAttempt: this.lastSyncAttempt,
      timeSinceLastSync: this.lastSyncAttempt
        ? Date.now() - this.lastSyncAttempt
        : null
    };
  }

  /**
   * Cleanup - Stop all sync activities
   */
  cleanup() {
    console.log('🧹 Cleaning up SyncScheduler');
    this.stopPeriodicSync();
    this.syncCallbacks.clear();
    this.isInitialized = false;
  }
}

// Create singleton instance
const syncScheduler = new SyncScheduler();

// Export singleton instance and class
export default syncScheduler;
export { SyncScheduler };

/**
 * Initialize sync scheduler
 * Call this once when app starts
 */
export const initializeSyncScheduler = async () => {
  await syncScheduler.initialize();
};

/**
 * Manual sync trigger (rate-limited)
 */
export const triggerManualSync = async () => {
  return await syncScheduler.triggerSync('manual');
};

/**
 * Force sync (bypasses rate limiting)
 */
export const forceSync = async () => {
  return await syncScheduler.forceSync();
};

/**
 * Get scheduler status
 */
export const getSchedulerStatus = () => {
  return syncScheduler.getStatus();
};
