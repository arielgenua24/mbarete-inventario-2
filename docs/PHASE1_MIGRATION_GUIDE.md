# Phase 1: Migration & Testing Guide

**Phase:** IndexedDB + Timestamps Migration
**Status:** Ready to Execute
**Duration:** 2-3 hours

---

## 📋 PRE-MIGRATION CHECKLIST

Before running the migration, ensure:

- [ ] Git backup created (you'll handle this)
- [ ] Application is deployed and accessible
- [ ] You have admin access to Firestore
- [ ] No critical operations running (wait for quiet time)
- [ ] Team members notified (if applicable)

---

## 🚀 STEP 1: Run the Migration

### Access the Migration Runner

1. Start your development server:
```bash
npm run dev
```

2. Open your browser and navigate to:
```
http://localhost:5173/#/migration-runner
```
(or your dev URL)

3. You'll see the Migration Runner page with a big button: **"🚀 Start Migration"**

### Execute Migration

1. Click **"🚀 Start Migration"**
2. Wait for the process to complete (may take a few minutes depending on product count)
3. You should see:
   - ✅ **Migration Successful!**
   - Number of products migrated
   - Metadata created: Yes ✓

### Verify Migration

1. Click **"🔍 Verify Migration"** button
2. Check the results:
   - **With timestamp:** Should show ALL your products
   - **Without timestamp:** Should show 0

If verification shows products without timestamps, click "🔄 Retry Migration".

---

## 🧪 STEP 2: Test IndexedDB Operations

### Open Browser DevTools

1. Open Chrome DevTools (F12 or Cmd+Option+I)
2. Go to **Console** tab
3. Run the following tests:

### Test 1: Initialize IndexedDB

```javascript
// Import and initialize
import { initializeDB, getDBStats } from '/src/src/db/indexedDB.js';

// Initialize database
await initializeDB();

// Check stats
const stats = await getDBStats();
console.log('Database Stats:', stats);
```

**Expected output:**
```
✅ IndexedDB initialized successfully
Database name: reina-chura-db
Database version: 1
✅ Created initial catalogMetadata
```

### Test 2: Save Products to IndexedDB

```javascript
import { saveProducts, getProductsCount } from '/src/src/services/cacheService.js';

// Test data
const testProducts = [
  {
    id: 'test-1',
    name: 'Blusa Rosa',
    productCode: '#001',
    price: 5000,
    stock: 10,
    updatedAt: new Date()
  },
  {
    id: 'test-2',
    name: 'Pantalón Negro',
    productCode: '#002',
    price: 8000,
    stock: 5,
    updatedAt: new Date()
  }
];

// Save to IndexedDB
await saveProducts(testProducts);

// Verify count
const count = await getProductsCount();
console.log('Products in IndexedDB:', count);
```

**Expected output:**
```
✅ Saved 2 products to IndexedDB
Products in IndexedDB: 2
```

### Test 3: Search Products

```javascript
import { searchProducts } from '/src/src/services/cacheService.js';

// Search by name
const results = await searchProducts('blusa');
console.log('Search results:', results);
```

**Expected output:**
```
[{ id: 'test-1', name: 'blusa rosa', ... }]
```

### Test 4: Check Storage Usage

```javascript
import { getStorageUsage } from '/src/src/services/cacheService.js';

const usage = await getStorageUsage();
console.log('Storage Usage:', usage);
```

**Expected output:**
```
{
  usage: 123456,
  quota: 50000000000,
  percentage: "0.00",
  usageMB: "0.12",
  quotaMB: "47683.72"
}
```

### Test 5: Inspect IndexedDB Manually

1. In DevTools, go to **Application** tab
2. Expand **IndexedDB** → `reina-chura-db`
3. Click on each store to inspect:
   - **products** - Should have your test products
   - **catalogMetadata** - Should have one entry with id: "local"
   - **pendingOrders** - Should be empty
   - **syncQueue** - Should be empty
   - **orderHistory** - Should be empty

---

## ✅ VERIFICATION CHECKLIST

After migration and testing:

- [ ] Migration completed successfully
- [ ] All products have Firestore timestamps
- [ ] `metadata/catalog` document exists in Firestore
- [ ] IndexedDB initialized without errors
- [ ] Can save products to IndexedDB
- [ ] Can search products in IndexedDB
- [ ] Can inspect IndexedDB in DevTools
- [ ] Storage usage is reasonable (<100MB for 1000 products)

---

## 🔧 TROUBLESHOOTING

### Issue: Migration fails with "Permission denied"

**Solution:** Check Firebase security rules. Ensure you're authenticated as admin.

### Issue: IndexedDB quota exceeded

**Solution:**
```javascript
// Clear all data and retry
import { clearAllData } from '/src/src/db/indexedDB.js';
await clearAllData();
```

### Issue: Products not showing in IndexedDB

**Solution:** Check browser console for errors. Try:
```javascript
import { db } from '/src/src/db/indexedDB.js';
const products = await db.products.toArray();
console.log(products);
```

### Issue: Timestamp format is wrong

**Solution:** Verify Firestore has `serverTimestamp()` not string dates:
```javascript
// In Firestore Console, check a product document
// updatedAt should be: "Timestamp" type, NOT "string"
```

---

## 📊 WHAT CHANGED

### Firestore Changes

#### Products Collection

**Before:**
```javascript
{
  id: "abc123",
  name: "blusa rosa",
  price: 5000,
  stock: 10,
  updatedAt: "2026-01-28 10:30:00" // String
}
```

**After:**
```javascript
{
  id: "abc123",
  name: "blusa rosa",
  price: 5000,
  stock: 10,
  updatedAt: Timestamp(seconds: 1737954600, nanoseconds: 0), // Firestore Timestamp
  createdAt: "2026-01-28 10:30:00", // Display string (new field)
  _migrated: true,
  _migratedAt: "2026-01-28T14:30:00.000Z"
}
```

#### New Collection: `metadata`

**Document: `metadata/catalog`**
```javascript
{
  lastUpdated: Timestamp(seconds: 1737954600, nanoseconds: 0),
  totalProducts: 150,
  version: 1,
  createdAt: Timestamp(...),
  description: "Catalog metadata for offline-first sync"
}
```

### Code Changes

#### useFirestore Hook

**`addProduct` function:**
- Now uses `serverTimestamp()` for `updatedAt`
- Updates `metadata/catalog` after adding product

**`updateProduct` function:**
- Now uses `writeBatch()` for atomic updates
- Updates both product AND `metadata/catalog` atomically
- Uses `serverTimestamp()` for `updatedAt`

---

## 🎯 NEXT STEPS

After successful Phase 1 completion:

1. ✅ Mark Phase 1 as complete in `IMPLEMENTATION_PHASES.md`
2. 🚀 Proceed to **Phase 2: Sync System**
3. 🗑️ Delete `/migration-runner` route from App.jsx (optional)
4. 🗑️ Delete `MigrationRunner.jsx` page (optional)
5. 🗑️ Keep `migrationService.js` for reference

---

## 📝 NOTES

- The migration is **idempotent** - safe to run multiple times
- Firestore timestamps are **server-side** - no clock sync issues
- IndexedDB can store **~50GB** on most devices
- Products update metadata automatically going forward
- Migration flags (`_migrated`, `_migratedAt`) are for tracking only

---

**Last Updated:** 2026-01-28
**Status:** ✅ Ready for Execution
