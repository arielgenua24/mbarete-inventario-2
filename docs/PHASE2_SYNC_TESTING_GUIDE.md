# Phase 2 - Sync System Testing Guide

**Created:** 2026-01-28
**Status:** Ready for Testing

---

## 🎯 What We Built

Phase 2 implements a complete synchronization system between Firestore (remote) and IndexedDB (local):

### Components Created

1. **syncService.js** (414 lines)
   - `checkForUpdates()` - Compares local/remote timestamps
   - `fullSync()` - Downloads all products (first time or >7 days outdated)
   - `deltaSync()` - Downloads only changed products
   - `smartSync()` - Automatically chooses sync strategy
   - `getSyncStatus()` - Returns current sync state

2. **useSync Hook** (173 lines)
   - React hook for components to access sync functionality
   - Provides: status, lastSynced, totalProducts, error, isSyncing
   - Actions: triggerSync(), checkSyncNeeded(), loadSyncStatus()
   - Auto-polls status every 10 seconds

3. **syncScheduler.js** (270 lines)
   - Automatic sync triggers
   - Syncs on: app startup, every 5 minutes, reconnect, visibility change
   - Rate limiting (30s minimum between syncs)
   - Event callbacks for monitoring

4. **syncWorker.js** (330 lines)
   - Background sync queue processor
   - Processes pending orders and product updates
   - Retry logic with exponential backoff (1s, 5s, 30s)
   - Max 3 retries per task

5. **SyncDebug.jsx** (270 lines)
   - Real-time monitoring UI
   - Shows sync status, scheduler status, worker status
   - Lists pending tasks and orders
   - Manual sync triggers

---

## 🧪 Testing Steps

### 1. Initial Setup

Navigate to the sync debug page:
```
http://localhost:5174/#/sync-debug
```

You should see:
- ✅ Sync status card
- ✅ Scheduler status (Running, Online)
- ✅ Worker status (Running)
- ✅ IndexedDB stats

### 2. Test Initial Sync (First Time)

**Expected:** Full sync should trigger automatically 2 seconds after app loads

1. Open browser DevTools → Console
2. Look for these logs:
   ```
   ✅ IndexedDB initialized
   ✅ Sync scheduler initialized
   ✅ Sync worker started
   🔄 Triggering sync (app_startup)
   📦 First sync - will download full catalog
   🚀 Starting FULL SYNC...
   📥 Downloaded X products...
   ✅ FULL SYNC complete! X products in Ys
   ```

3. Check IndexedDB:
   - Open DevTools → Application → IndexedDB → reina-chura-db → products
   - Should see all products from Firestore
   - Each product should have: id, name, productCode, updatedAt, etc.

4. Check SyncDebug page:
   - Status: "Synced" (green badge)
   - Last Synced: "Just now"
   - Total Products: [number of products]

**✅ Success:** Products visible in IndexedDB, status shows "Synced"

---

### 3. Test Delta Sync (Changes Only)

**Expected:** Only changed products should be downloaded

1. Go to Firestore Console
2. Edit a product (change name or price)
3. Wait 30 seconds (rate limit)
4. Click "Manual Sync" button in SyncDebug page
5. Check console logs:
   ```
   ⚡ Starting DELTA SYNC...
   📥 Found 1 changed products
   ✅ Updated 1 products in local DB
   ✅ DELTA SYNC complete! 1 changes in Xs
   ```

6. Verify in IndexedDB:
   - Find the edited product
   - Should have updated values
   - `updatedAt` should be newer

**✅ Success:** Only changed product updated, not full catalog re-downloaded

---

### 4. Test No Sync Needed (Already Up to Date)

**Expected:** Sync should skip if already up to date

1. Click "Manual Sync" immediately after a successful sync
2. Check console logs:
   ```
   🧠 Running smart sync...
   ✅ Already up to date
   ✅ No sync needed
   ```

**✅ Success:** Sync skipped with "Already up to date" message

---

### 5. Test Periodic Auto-Sync (Every 5 Minutes)

**Expected:** Sync should trigger automatically every 5 minutes

1. Keep SyncDebug page open
2. Wait 5 minutes
3. Check console logs:
   ```
   🔄 Triggering sync (periodic)
   ```

4. Or observe "Last Synced" updating automatically

**Note:** For faster testing, you can temporarily change `SYNC_INTERVAL_MS` in syncScheduler.js to 30 seconds

**✅ Success:** Auto-sync triggered after 5 minutes

---

### 6. Test Network Reconnection Sync

**Expected:** Sync should trigger when connection restored

1. Open DevTools → Network tab
2. Click "Offline" checkbox (or throttle to "Offline")
3. Wait a few seconds
4. Uncheck "Offline" (go back online)
5. Check console logs:
   ```
   🌐 Network connection restored
   🔄 Handling online event
   🔄 Triggering sync (network_restored)
   ```

**✅ Success:** Sync triggered immediately after reconnection

---

### 7. Test Visibility Change Sync

**Expected:** Sync should trigger when app becomes visible

1. Switch to a different browser tab (make app hidden)
2. Wait 30+ seconds
3. Switch back to app tab
4. Check console logs:
   ```
   👁️ App became visible
   🔄 Triggering sync (visibility_change)
   ```

**✅ Success:** Sync triggered when returning to tab

---

### 8. Test Rate Limiting

**Expected:** Syncs less than 30 seconds apart should be skipped

1. Click "Manual Sync" button
2. Immediately click "Manual Sync" again
3. Check console logs:
   ```
   ⏭️ Skipping sync (manual): too soon or already syncing
   ```

4. Try "Force Sync" button
5. Should work even within 30s window

**✅ Success:** Rate limiting working, Force Sync bypasses it

---

### 9. Test Offline Mode

**Expected:** App should work with cached data, skip syncs when offline

1. Open DevTools → Network → Set to "Offline"
2. Check SyncDebug page:
   - Online badge should show "Offline" (red)
   - Periodic sync should stop
3. Try "Manual Sync" button
4. Should skip with message: "Offline, skipping..."

**✅ Success:** App knows it's offline, doesn't attempt syncs

---

### 10. Test Full Sync (Very Outdated)

**Expected:** If >7 days outdated, should do full sync instead of delta

1. Open IndexedDB → catalogMetadata
2. Manually edit `lastSynced` to 8 days ago:
   ```javascript
   // In console:
   const db = await window.indexedDB.databases();
   // Use Dexie to update metadata
   ```

3. Click "Manual Sync"
4. Check console logs:
   ```
   🔄 Very outdated, will do full sync
   🚀 Starting FULL SYNC...
   ```

**✅ Success:** Full sync triggered for very outdated catalog

---

## 🔍 What to Check

### Console Logs

You should see these types of logs:
- ✅ Initialization logs (IndexedDB, Scheduler, Worker)
- 🔄 Sync trigger logs with reasons
- 📊 Sync comparison logs (remote vs local timestamps)
- ✅ Sync completion logs with stats

### IndexedDB (DevTools → Application)

Check these stores:
- **products**: Should have all products from Firestore
- **catalogMetadata**: Should have `lastSynced`, `totalProducts`, `syncStatus`
- **syncQueue**: Should be empty (all tasks processed)
- **pendingOrders**: Should be empty (no orders created yet)

### SyncDebug Page

Monitor these sections:
- **Sync Status**: Shows current sync state
- **Network & Scheduler**: Shows online status, scheduler running
- **Sync Worker**: Shows worker running, pending tasks count
- **IndexedDB Stats**: Shows counts for each store

---

## 🐛 Common Issues

### Issue: "Failed to check for updates"

**Cause:** Firestore metadata/catalog doesn't exist
**Fix:** Run migration again to create metadata document

### Issue: Sync keeps saying "Syncing..." forever

**Cause:** Network error or Firestore permission issue
**Check:** Browser console for error details
**Fix:** Check Firebase Auth, Firestore rules

### Issue: "No changes to sync" but products are outdated

**Cause:** Local timestamp is newer than remote (shouldn't happen)
**Fix:** Clear IndexedDB and do fresh full sync

### Issue: Products not showing in IndexedDB

**Cause:** Full sync failed silently
**Check:** Console logs for errors
**Fix:** Check network, Firestore rules, product indices

---

## 📊 Expected Performance

After successful sync:
- **Initial Full Sync:** ~5-10 seconds for 500 products
- **Delta Sync:** <1 second for 1-10 changes
- **Check for Updates:** <200ms (1 Firestore read)
- **IndexedDB Operations:** <50ms

---

## ✅ Sign-Off Checklist

Before moving to Phase 3, verify:
- [ ] Full sync works (downloads all products)
- [ ] Delta sync works (downloads only changes)
- [ ] Auto-sync triggers (startup, periodic, reconnect, visibility)
- [ ] Rate limiting works (30s minimum)
- [ ] Force sync bypasses rate limit
- [ ] Offline detection works
- [ ] IndexedDB populated correctly
- [ ] Console logs show proper sync flow
- [ ] SyncDebug page shows accurate status
- [ ] No errors in console

---

## 🚀 Next Steps

After Phase 2 testing passes:
1. **Phase 3:** Implement ultra-fast local search (<50ms)
2. **Phase 4:** Implement optimistic order creation (<100ms)

Phase 2 is the foundation for everything else. Make sure it's solid before proceeding!

---

**Testing Completed:** ___________
**Issues Found:** ___________
**Ready for Phase 3:** ☐ Yes ☐ No
