/**
 * ImageKit Authentication Cache Service
 *
 * Manages authentication tokens with smart caching to reduce Edge Requests
 * and ensure seamless user experience even when tokens expire.
 *
 * Features:
 * - Caches auth tokens until expiration
 * - Automatic refresh 2 minutes before expiry
 * - Transparent retry on expired tokens
 * - Thread-safe token refresh (prevents duplicate requests)
 */

class ImageKitAuthCache {
  constructor() {
    this.cache = {
      token: null,
      signature: null,
      expire: null, // Unix timestamp in seconds
    };
    this.pendingRequest = null; // Prevent duplicate simultaneous requests
    this.EXPIRY_BUFFER_MS = 2 * 60 * 1000; // Refresh 2 minutes before expiry
  }

  /**
   * Get authentication endpoint based on environment
   */
  getAuthEndpoint() {
    if (import.meta.env.VITE_IMAGEKIT_AUTH_ENDPOINT) {
      return import.meta.env.VITE_IMAGEKIT_AUTH_ENDPOINT;
    } else if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:3001/api/auth";
    } else {
      return `${window.location.origin}/api/auth`;
    }
  }

  /**
   * Check if cached token is still valid
   * Returns true if token exists and hasn't expired (with buffer)
   */
  isTokenValid() {
    if (!this.cache.token || !this.cache.expire) {
      return false;
    }

    const now = Date.now();
    const expiryTime = this.cache.expire * 1000; // Convert to milliseconds
    const expiryWithBuffer = expiryTime - this.EXPIRY_BUFFER_MS;

    return now < expiryWithBuffer;
  }

  /**
   * Fetch new authentication parameters from backend
   */
  async fetchAuthParams() {
    const authEndpoint = this.getAuthEndpoint();

    console.log('[ImageKit Auth] Fetching new token from:', authEndpoint);

    const response = await fetch(authEndpoint);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ImageKit Auth] Endpoint error:', errorText);
      throw new Error(`Failed to get authentication: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const errorText = await response.text();
      console.error('[ImageKit Auth] Non-JSON response:', errorText);
      throw new Error('Auth endpoint returned non-JSON response');
    }

    const authData = await response.json();

    // Validate response has required fields
    if (!authData.token || !authData.signature || !authData.expire) {
      console.error('[ImageKit Auth] Invalid response:', authData);
      throw new Error('Invalid authentication response');
    }

    return authData;
  }

  /**
   * Get authentication parameters
   * Uses cache if valid, otherwise fetches new token
   * Prevents duplicate simultaneous requests
   */
  async getAuthParams() {
    // If token is still valid, return cached version
    if (this.isTokenValid()) {
      const remainingSeconds = this.cache.expire - Math.floor(Date.now() / 1000);
      console.log(`[ImageKit Auth] Using cached token (expires in ${remainingSeconds}s)`);
      return { ...this.cache };
    }

    // If there's already a pending request, wait for it
    if (this.pendingRequest) {
      console.log('[ImageKit Auth] Waiting for pending request...');
      return await this.pendingRequest;
    }

    // Fetch new token
    this.pendingRequest = (async () => {
      try {
        const authData = await this.fetchAuthParams();

        // Cache the new token
        this.cache = {
          token: authData.token,
          signature: authData.signature,
          expire: authData.expire,
        };

        const expiryDate = new Date(authData.expire * 1000);
        console.log(`[ImageKit Auth] Token cached (expires at ${expiryDate.toLocaleTimeString()})`);

        return { ...this.cache };
      } finally {
        // Clear pending request flag
        this.pendingRequest = null;
      }
    })();

    return await this.pendingRequest;
  }

  /**
   * Force refresh authentication (used for retry after upload failure)
   */
  async forceRefresh() {
    console.log('[ImageKit Auth] Forcing token refresh...');
    this.cache.expire = null; // Invalidate cache
    return await this.getAuthParams();
  }

  /**
   * Clear the cache (useful for testing or manual invalidation)
   */
  clearCache() {
    console.log('[ImageKit Auth] Cache cleared');
    this.cache = {
      token: null,
      signature: null,
      expire: null,
    };
  }
}

// Singleton instance
const authCache = new ImageKitAuthCache();

export default authCache;
