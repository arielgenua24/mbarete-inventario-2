/**
 * Sync Events - Global event system for sync notifications
 *
 * Allows components to listen for sync completions and data changes
 */

class SyncEventEmitter {
  constructor() {
    this.listeners = new Set();
  }

  /**
   * Subscribe to sync events
   * @param {Function} callback - Called with (eventType, data)
   * @returns {Function} - Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Emit an event to all listeners
   * @param {string} eventType - Type of event
   * @param {Object} data - Event data
   */
  emit(eventType, data) {
    this.listeners.forEach(listener => {
      try {
        listener(eventType, data);
      } catch (error) {
        console.error('Error in sync event listener:', error);
      }
    });
  }

  /**
   * Notify that products have been updated in IndexedDB
   */
  notifyProductsUpdated(count) {
    this.emit('products_updated', { count, timestamp: Date.now() });
  }

  /**
   * Notify that sync completed
   */
  notifySyncComplete(result) {
    this.emit('sync_complete', result);
  }

  /**
   * Notify that sync failed
   */
  notifySyncError(error) {
    this.emit('sync_error', { error, timestamp: Date.now() });
  }
}

// Create singleton
const syncEvents = new SyncEventEmitter();

export default syncEvents;

/**
 * Hook to listen for product updates
 * Use this in components that display product data
 */
export const useSyncEvents = (callback) => {
  if (typeof window !== 'undefined') {
    const { useEffect } = require('react');
    useEffect(() => {
      return syncEvents.subscribe(callback);
    }, [callback]);
  }
};
