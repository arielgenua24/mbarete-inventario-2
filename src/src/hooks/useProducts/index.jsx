/**
 * useProducts Hook - Local Product Search from IndexedDB
 *
 * Provides ultra-fast product search and retrieval from IndexedDB
 * Replaces Firestore queries for offline-first functionality
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getAllProducts,
  searchProducts,
  getProduct
} from '../../services/cacheService';
import syncEvents from '../../services/syncEvents';

const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load all products from IndexedDB
   * Used for initial catalog display
   *
   * @param {number} limit - Maximum number of products to load
   * @returns {Promise<Array>}
   */
  const loadProducts = useCallback(async (limit = 50) => {
    setIsLoading(true);
    setError(null);
    try {
      const startTime = performance.now();
      const allProducts = await getAllProducts();

      // Apply limit
      const limitedProducts = limit ? allProducts.slice(0, limit) : allProducts;

      const duration = performance.now() - startTime;
      console.log(`📦 Loaded ${limitedProducts.length} products in ${duration.toFixed(2)}ms`);

      setProducts(limitedProducts);
      return limitedProducts;
    } catch (err) {
      console.error('❌ Error loading products:', err);
      setError(err.message);
      setProducts([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Search products by name or product code
   * Uses IndexedDB indices for ultra-fast search
   *
   * @param {string} searchTerm - Search query
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>}
   */
  const searchProductsByNameOrCode = useCallback(async (searchTerm, limit = 20) => {
    if (!searchTerm || !searchTerm.trim()) {
      return [];
    }

    setIsLoading(true);
    setError(null);
    try {
      const startTime = performance.now();
      const results = await searchProducts(searchTerm.trim(), limit);
      const duration = performance.now() - startTime;

      console.log(`🔍 Search "${searchTerm}" found ${results.length} products in ${duration.toFixed(2)}ms`);

      return results;
    } catch (err) {
      console.error('❌ Error searching products:', err);
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get a single product by ID
   *
   * @param {string} productId - Product ID
   * @returns {Promise<Object|null>}
   */
  const getProductById = useCallback(async (productId) => {
    setIsLoading(true);
    setError(null);
    try {
      const product = await getProduct(productId);
      return product;
    } catch (err) {
      console.error('❌ Error getting product:', err);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get products with pagination
   * Simulates Firestore pagination for backwards compatibility
   *
   * @param {number} pageSize - Number of products per page
   * @param {number} page - Page number (0-indexed)
   * @returns {Promise<Object>}
   */
  const getProductsPaginated = useCallback(async (pageSize = 10, page = 0) => {
    setIsLoading(true);
    setError(null);
    try {
      const startTime = performance.now();
      const allProducts = await getAllProducts();

      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedProducts = allProducts.slice(startIndex, endIndex);
      const hasMore = endIndex < allProducts.length;

      const duration = performance.now() - startTime;
      console.log(`📄 Page ${page} loaded ${paginatedProducts.length} products in ${duration.toFixed(2)}ms`);

      return {
        products: paginatedProducts,
        hasMore,
        page,
        totalProducts: allProducts.length
      };
    } catch (err) {
      console.error('❌ Error loading paginated products:', err);
      setError(err.message);
      return {
        products: [],
        hasMore: false,
        page: 0,
        totalProducts: 0
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get products by category
   *
   * @param {string} category - Category name
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>}
   */
  const getProductsByCategory = useCallback(async (category, limit = 50) => {
    setIsLoading(true);
    setError(null);
    try {
      const allProducts = await getAllProducts();
      const filtered = allProducts
        .filter(p => p.category && p.category.toLowerCase() === category.toLowerCase())
        .slice(0, limit);

      return filtered;
    } catch (err) {
      console.error('❌ Error getting products by category:', err);
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get low stock products
   *
   * @param {number} threshold - Stock threshold (default: 10)
   * @returns {Promise<Array>}
   */
  const getLowStockProducts = useCallback(async (threshold = 10) => {
    setIsLoading(true);
    setError(null);
    try {
      const allProducts = await getAllProducts();
      const lowStock = allProducts.filter(p => p.stock <= threshold);

      console.log(`⚠️ Found ${lowStock.length} low stock products`);
      return lowStock;
    } catch (err) {
      console.error('❌ Error getting low stock products:', err);
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh products when sync completes
   * Automatically reloads products after background sync
   */
  useEffect(() => {
    const unsubscribe = syncEvents.subscribe((event, data) => {
      if (event === 'products_updated') {
        console.log('🔄 Products updated, reloading...');
        // Only reload if we have products loaded
        if (products.length > 0) {
          loadProducts(products.length);
        }
      }
    });

    return unsubscribe;
  }, [products.length, loadProducts]);

  return {
    // State
    products,
    isLoading,
    error,

    // Actions
    loadProducts,
    searchProductsByNameOrCode,
    getProductById,
    getProductsPaginated,
    getProductsByCategory,
    getLowStockProducts
  };
};

export default useProducts;
