/**
 * Migration Service - Firestore Timestamp Migration
 *
 * This script migrates existing products to use Firestore serverTimestamp()
 * instead of formatted date strings. This enables delta sync functionality.
 *
 * ⚠️ RUN THIS ONCE during Phase 1 implementation
 */

import { db as firestore } from '../firebaseSetUp';
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
  setDoc,
  Timestamp
} from 'firebase/firestore';

/**
 * Migrate all products to use Firestore serverTimestamp
 *
 * Steps:
 * 1. Read all products from Firestore
 * 2. For each product, add/update `updatedAt` field with serverTimestamp()
 * 3. Process in batches of 500 (Firestore limit)
 * 4. Update metadata/catalog with lastUpdated timestamp
 *
 * @returns {Promise<Object>} - Migration results
 */
export const migrateProductTimestamps = async () => {
  console.log('🚀 Starting Firestore timestamp migration...');

  try {
    // Step 1: Get all products
    const productsRef = collection(firestore, 'products');
    const snapshot = await getDocs(productsRef);

    console.log(`📦 Found ${snapshot.docs.length} products to migrate`);

    if (snapshot.empty) {
      console.log('⚠️ No products found. Skipping migration.');
      return {
        success: true,
        productsUpdated: 0,
        message: 'No products to migrate'
      };
    }

    // Step 2: Process in batches of 500 (Firestore limit)
    const BATCH_SIZE = 500;
    let batch = writeBatch(firestore);
    let batchCount = 0;
    let totalUpdated = 0;

    for (let i = 0; i < snapshot.docs.length; i++) {
      const productDoc = snapshot.docs[i];
      const productData = productDoc.data();

      // Update the product with serverTimestamp
      const productRef = doc(firestore, 'products', productDoc.id);

      // Preserve existing data but override updatedAt
      const { updatedAt: oldTimestamp, ...restData } = productData;

      batch.update(productRef, {
        ...restData,
        updatedAt: serverTimestamp(), // New Firestore timestamp
        createdAt: oldTimestamp, // Preserve old timestamp for display
        _migrated: true,
        _migratedAt: new Date().toISOString()
      });

      batchCount++;

      // Commit batch when reaching 500 or at the end
      if (batchCount === BATCH_SIZE || i === snapshot.docs.length - 1) {
        await batch.commit();
        totalUpdated += batchCount;
        console.log(`✅ Updated ${totalUpdated}/${snapshot.docs.length} products`);

        // Create new batch for next iteration
        batch = writeBatch(firestore);
        batchCount = 0;
      }
    }

    console.log(`🎉 Migration complete! Updated ${totalUpdated} products`);

    return {
      success: true,
      productsUpdated: totalUpdated,
      message: `Successfully migrated ${totalUpdated} products`
    };
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

/**
 * Create or update the metadata/catalog document
 * This document tracks the last time ANY product was updated
 *
 * @returns {Promise<boolean>}
 */
export const createCatalogMetadata = async () => {
  console.log('🚀 Creating/updating catalog metadata...');

  try {
    const metadataRef = doc(firestore, 'metadata', 'catalog');

    // Count total products
    const productsSnapshot = await getDocs(collection(firestore, 'products'));
    const totalProducts = productsSnapshot.docs.length;

    await setDoc(metadataRef, {
      lastUpdated: serverTimestamp(),
      totalProducts,
      version: 1,
      createdAt: serverTimestamp(),
      description: 'Catalog metadata for offline-first sync'
    }, { merge: true });

    console.log('✅ Catalog metadata created/updated');
    console.log(`📊 Total products: ${totalProducts}`);

    return true;
  } catch (error) {
    console.error('❌ Failed to create catalog metadata:', error);
    throw error;
  }
};

/**
 * Run full migration (products + metadata)
 * This is the main function to call
 *
 * @returns {Promise<Object>}
 */
export const runFullMigration = async () => {
  console.log('🚀 Starting FULL migration...\n');

  const results = {
    products: null,
    metadata: false,
    success: false,
    errors: []
  };

  try {
    // Step 1: Migrate products
    console.log('Step 1/2: Migrating product timestamps...');
    results.products = await migrateProductTimestamps();
    console.log('');

    // Step 2: Create/update metadata
    console.log('Step 2/2: Creating catalog metadata...');
    results.metadata = await createCatalogMetadata();
    console.log('');

    results.success = true;

    console.log('🎉 FULL MIGRATION COMPLETE!');
    console.log('Summary:');
    console.log(`- Products migrated: ${results.products.productsUpdated}`);
    console.log(`- Metadata created: ${results.metadata ? 'Yes' : 'No'}`);

    return results;
  } catch (error) {
    console.error('❌ MIGRATION FAILED:', error);
    results.success = false;
    results.errors.push(error.message);
    throw error;
  }
};

/**
 * Verify migration success
 * Checks if all products have proper timestamps
 *
 * @returns {Promise<Object>}
 */
export const verifyMigration = async () => {
  console.log('🔍 Verifying migration...');

  try {
    const productsSnapshot = await getDocs(collection(firestore, 'products'));
    const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const withTimestamp = products.filter(p => p.updatedAt instanceof Timestamp);
    const withoutTimestamp = products.filter(p => !(p.updatedAt instanceof Timestamp));

    console.log(`✅ Products with Timestamp: ${withTimestamp.length}`);
    console.log(`⚠️ Products without Timestamp: ${withoutTimestamp.length}`);

    if (withoutTimestamp.length > 0) {
      console.log('Products missing proper timestamp:');
      withoutTimestamp.forEach(p => {
        console.log(`- ${p.id}: ${p.name} (updatedAt: ${p.updatedAt})`);
      });
    }

    return {
      total: products.length,
      withTimestamp: withTimestamp.length,
      withoutTimestamp: withoutTimestamp.length,
      success: withoutTimestamp.length === 0
    };
  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  }
};

/**
 * Clean migration flags (optional)
 * Removes _migrated and _migratedAt fields after successful migration
 *
 * Run this AFTER verifying migration is successful
 */
export const cleanMigrationFlags = async () => {
  console.log('🧹 Cleaning migration flags...');

  try {
    const productsSnapshot = await getDocs(collection(firestore, 'products'));
    const BATCH_SIZE = 500;
    let batch = writeBatch(firestore);
    let batchCount = 0;
    let totalCleaned = 0;

    for (let i = 0; i < productsSnapshot.docs.length; i++) {
      const productDoc = productsSnapshot.docs[i];
      const productRef = doc(firestore, 'products', productDoc.id);

      // Remove migration flags (keep updatedAt and createdAt)
      batch.update(productRef, {
        _migrated: Timestamp.fromDate(new Date(0)), // Use deleteField() if available
        _migratedAt: Timestamp.fromDate(new Date(0))
      });

      batchCount++;

      if (batchCount === BATCH_SIZE || i === productsSnapshot.docs.length - 1) {
        await batch.commit();
        totalCleaned += batchCount;
        console.log(`Cleaned ${totalCleaned}/${productsSnapshot.docs.length} products`);
        batch = writeBatch(firestore);
        batchCount = 0;
      }
    }

    console.log(`✅ Cleanup complete. ${totalCleaned} products processed.`);

    return {
      success: true,
      productsCleaned: totalCleaned
    };
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
};

/**
 * Rollback migration (emergency use only)
 * Removes migration flags and timestamps
 *
 * ⚠️ USE WITH CAUTION
 */
export const rollbackMigration = async () => {
  console.log('⚠️ Rolling back migration...');

  const confirmed = confirm(
    'Are you sure you want to rollback the migration? This cannot be undone.'
  );

  if (!confirmed) {
    console.log('Rollback cancelled');
    return { success: false, message: 'Rollback cancelled by user' };
  }

  try {
    const productsSnapshot = await getDocs(collection(firestore, 'products'));
    const BATCH_SIZE = 500;
    let batch = writeBatch(firestore);
    let batchCount = 0;
    let totalRolledBack = 0;

    for (let i = 0; i < productsSnapshot.docs.length; i++) {
      const productDoc = productsSnapshot.docs[i];
      const productRef = doc(firestore, 'products', productDoc.id);

      // Remove migration-specific fields
      batch.update(productRef, {
        _migrated: Timestamp.fromDate(new Date(0)),
        _migratedAt: Timestamp.fromDate(new Date(0))
        // Keep updatedAt for now (manual decision)
      });

      batchCount++;

      if (batchCount === BATCH_SIZE || i === productsSnapshot.docs.length - 1) {
        await batch.commit();
        totalRolledBack += batchCount;
        console.log(`Rolled back ${totalRolledBack}/${productsSnapshot.docs.length} products`);
        batch = writeBatch(firestore);
        batchCount = 0;
      }
    }

    console.log(`✅ Rollback complete. ${totalRolledBack} products processed.`);

    return {
      success: true,
      productsRolledBack: totalRolledBack
    };
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
};

// Export main functions
export default {
  migrateProductTimestamps,
  createCatalogMetadata,
  runFullMigration,
  verifyMigration,
  cleanMigrationFlags,
  rollbackMigration
};
