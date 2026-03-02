# Testing Environment Setup - Reina Chura

**Purpose:** Configure Chrome DevTools for testing offline-first functionality

---

## 🌐 Network Throttling Profiles

Use Chrome DevTools to simulate different network conditions during development and testing.

### How to Access
1. Open Chrome DevTools (`F12` or `Cmd+Option+I`)
2. Go to **Network** tab
3. Find **Throttling** dropdown (top of Network tab)
4. Select or create custom profiles

---

## 📋 Required Profiles

### 1. **Offline Mode**
- **Use case:** Test complete offline functionality
- **Settings:**
  - Preset: **Offline**
  - Download: 0 kb/s
  - Upload: 0 kb/s
  - Latency: 0 ms

**Test scenarios:**
- Search products while offline
- Create orders while offline
- Verify data persists in IndexedDB
- Verify QR code generation works

---

### 2. **3G Slow (Realistic Poor Connection)**
- **Use case:** Simulate real WiFi issues in Avellaneda
- **Settings:**
  - Preset: **Slow 3G**
  - Download: 400 kb/s
  - Upload: 400 kb/s
  - Latency: 2000 ms

**Test scenarios:**
- Search should still be fast (<50ms from IndexedDB)
- Order creation should still be instant
- Background sync takes longer but works
- UI remains responsive

---

### 3. **Intermittent Connection (Custom)**
- **Use case:** Simulate WiFi that drops constantly
- **Manual simulation:**
  - Toggle between **Offline** and **Online** every 5 seconds
  - Use browser extension or manual switching

**Alternative method:**
```javascript
// Run in Console to simulate intermittent connection
let online = true;
setInterval(() => {
  online = !online;
  if (online) {
    console.log('🟢 Connection restored');
    window.dispatchEvent(new Event('online'));
  } else {
    console.log('🔴 Connection lost');
    window.dispatchEvent(new Event('offline'));
  }
}, 5000);
```

**Test scenarios:**
- Orders created offline sync when connection returns
- Sync scheduler retries automatically
- No duplicate syncs occur

---

### 4. **Fast 3G (Moderate Connection)**
- **Use case:** Baseline acceptable connection
- **Settings:**
  - Preset: **Fast 3G**
  - Download: 1.6 Mb/s
  - Upload: 750 kb/s
  - Latency: 562.5 ms

**Test scenarios:**
- All features work smoothly
- Delta sync completes in reasonable time
- No timeout errors

---

## 🧪 Testing Checklist

### Phase 1-2: Basic Functionality
- [ ] Test with **Offline** - IndexedDB reads/writes work
- [ ] Test with **3G Slow** - Sync completes (may take time)
- [ ] Test with **Fast 3G** - Everything smooth

### Phase 3: Search
- [ ] **Offline** - Search returns results from IndexedDB
- [ ] **3G Slow** - Search still <50ms (not affected by network)
- [ ] Compare search speed vs old implementation

### Phase 4: Orders
- [ ] **Offline** - Order creation works, saves to pendingOrders
- [ ] **Intermittent** - Order syncs when connection returns
- [ ] **3G Slow** - Order creation instant, sync in background

### Phase 5-7: Edge Cases
- [ ] **Offline → Online** - All pending orders sync
- [ ] **Intermittent** - No duplicate syncs
- [ ] Multiple tabs with different network states

---

## 🔍 Chrome DevTools - IndexedDB Inspection

### View IndexedDB Data
1. Open DevTools
2. Go to **Application** tab
3. Expand **IndexedDB** → `reina-chura-db`
4. Inspect stores: products, catalogMetadata, pendingOrders, etc.

### Useful Actions
- **Clear IndexedDB:** Right-click database → Delete database
- **View entries:** Click on store name to see all entries
- **Export data:** Right-click entry → Copy object

---

## 📊 Performance Monitoring

### Measure Search Performance
```javascript
// Run in Console
console.time('search');
// Trigger search in UI
console.timeEnd('search');
// Should be <50ms
```

### Measure Order Creation
```javascript
console.time('createOrder');
// Click "Finalizar pedido"
console.timeEnd('createOrder');
// Should be <100ms
```

### Monitor Background Sync
```javascript
// Check pending orders
const db = await window.indexedDB.databases();
console.log('Databases:', db);
```

---

## 🚨 Common Issues & Solutions

### Issue: IndexedDB not working
**Solution:** Check browser permissions, clear cache, try incognito mode

### Issue: Sync not triggering
**Solution:** Check Network tab for actual requests, verify online/offline events

### Issue: QuotaExceededError
**Solution:** Clear old data, check storage usage in DevTools → Application → Storage

---

## 📱 Mobile Testing

### iOS Safari
- Use **Develop** menu (enable in Safari settings)
- Connect iPhone via USB
- Throttle network on Mac

### Android Chrome
- Use `chrome://inspect` for remote debugging
- Enable USB debugging on device
- Throttle in DevTools

---

## 🎯 Performance Targets

| Metric | Target | Acceptable | Current |
|--------|--------|------------|---------|
| Search time | <50ms | <100ms | ~500-2000ms |
| Order creation | <100ms | <200ms | ~30-60s |
| Full sync (1000 products) | <30s | <60s | N/A |
| Delta sync (10 changes) | <5s | <10s | N/A |

---

## 📝 Test Log Template

```
Date: YYYY-MM-DD
Phase: X
Network: [Offline / 3G Slow / Intermittent / Online]

Test: [Description]
Expected: [Expected behavior]
Actual: [Actual behavior]
Result: [✅ Pass / ❌ Fail]
Notes: [Additional observations]
```

---

**Last Updated:** 2026-01-28
**Next Review:** Before Phase 3 (Search testing)
