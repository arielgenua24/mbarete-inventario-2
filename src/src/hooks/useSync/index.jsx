/**
 * useSync Hook - Sync Status & Controls
 *
 * Provides sync status and manual sync trigger for UI components
 * Monitors IndexedDB metadata to show real-time sync status
 */

import { useState, useEffect, useCallback } from 'react';
import { smartSync, getSyncStatus } from '../../services/syncService';
import { getMetadata } from '../../services/cacheService';
import syncScheduler from '../../services/syncScheduler';

const useSync = () => {
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'error'
  const [lastSynced, setLastSynced] = useState(null);
  const [totalProducts, setTotalProducts] = useState(0);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  /**
   * Load current sync status from IndexedDB
   */
  const loadSyncStatus = useCallback(async () => {
    try {
      const status = await getSyncStatus();

      setSyncStatus(status.status || 'idle');
      setLastSynced(status.lastSynced);
      setTotalProducts(status.totalProducts || 0);

      if (status.lastError) {
        setError(status.lastError);
      }
    } catch (err) {
      console.error('Failed to load sync status:', err);
      setError(err.message);
    }
  }, []);

  /**
   * Trigger manual sync
   */
  const triggerSync = useCallback(async () => {
    if (isSyncing) {
      console.log('Sync already in progress');
      return { success: false, message: 'Sync already in progress' };
    }

    try {
      setIsSyncing(true);
      setSyncStatus('syncing');
      setError(null);

      console.log('🔄 Manual sync triggered');
      const result = await smartSync();

      if (result.success) {
        console.log('✅ Sync completed successfully');
        setSyncStatus('synced');

        // Reload status to get updated metadata
        await loadSyncStatus();

        return { success: true, result };
      } else {
        console.error('❌ Sync failed:', result.error);
        setSyncStatus('error');
        setError(result.error);

        return { success: false, error: result.error };
      }
    } catch (err) {
      console.error('❌ Sync error:', err);
      setSyncStatus('error');
      setError(err.message);

      return { success: false, error: err.message };
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, loadSyncStatus]);

  /**
   * Check if sync is needed (without triggering)
   */
  const checkSyncNeeded = useCallback(async () => {
    try {
      const metadata = await getMetadata();

      if (!metadata || !metadata.lastSynced) {
        return { needed: true, reason: 'Never synced' };
      }

      const lastSyncDate = new Date(metadata.lastSynced);
      const now = new Date();
      const hoursSinceSync = (now - lastSyncDate) / (1000 * 60 * 60);

      if (hoursSinceSync > 24) {
        return { needed: true, reason: 'More than 24 hours since last sync' };
      }

      if (metadata.syncStatus === 'stale' || metadata.syncStatus === 'error') {
        return { needed: true, reason: `Status is ${metadata.syncStatus}` };
      }

      return { needed: false, reason: 'Up to date' };
    } catch (err) {
      console.error('Failed to check sync status:', err);
      return { needed: true, reason: 'Error checking status' };
    }
  }, []);

  /**
   * Get formatted time since last sync
   */
  const getTimeSinceSync = useCallback(() => {
    if (!lastSynced) {
      return 'Never';
    }

    const lastSyncDate = new Date(lastSynced);
    const now = new Date();
    const diffMs = now - lastSyncDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
  }, [lastSynced]);

  // Load initial status on mount
  useEffect(() => {
    loadSyncStatus();

    // Listen for sync events from scheduler
    const unsubscribe = syncScheduler.onSyncEvent((event, data) => {
      if (event === 'sync_complete') {
        // Immediately reload status after sync completes
        loadSyncStatus();
      }
    });

    // Poll for status updates every 10 seconds as backup
    const interval = setInterval(() => {
      loadSyncStatus();
    }, 10000);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [loadSyncStatus]);

  return {
    // Status
    syncStatus,
    lastSynced,
    totalProducts,
    pendingChanges,
    syncProgress,
    error,
    isSyncing,

    // Actions
    triggerSync,
    checkSyncNeeded,
    loadSyncStatus,

    // Utilities
    getTimeSinceSync,
  };
};

export default useSync;
