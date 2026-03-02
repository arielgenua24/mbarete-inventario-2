# Performance Analysis & Optimization Plan - Reina Chura Inventory System

**Date**: 2026-01-10
**Project**: Reina Chura - Real-time Inventory & Order Management System
**Location**: Avellaneda, Buenos Aires

---

## Business Context

### Company Situation
- **Business Type**: Women's clothing/products retail
- **Location**: Avellaneda, Buenos Aires (high competition area)
- **Critical Success Factor**: Speed of service (customers won't wait in line - they'll go to competitors)
- **Current Inventory**: 1000 products (expected to grow)
- **Average Order Size**: 10 products per order

### Workflow
1. Customer arrives and shows picture of desired product
2. Employee searches product in system (by code, name, or visual identification)
3. Employee finds physical product
4. Employee adds products to cart with quantities
5. Employee clicks "Finalizar pedido" in cart page
6. **BLOCKING STEP**: System saves order to database and generates PDF
7. Employee shares PDF with customer
8. Customer pays and leaves

---

## Critical Problems Identified

### Problem #1: Product Search Speed
**Impact**: Customers leave the line if search is too slow

**Current Behavior**:
- Employees need to search products by:
  - Product code (what they say they'll use)
  - Product name (what they'll actually use)
  - **Visual identification** (they want to see product images - MOST IMPORTANT)
- Search needs to be "the fastest search ever"
- Haven't fully tested search performance in real-time conditions yet

**Technical Analysis**:
- Current implementation: 4 separate Firebase queries per search
- 500ms debounce delay
- No caching strategy
- **No product images in search results** (critical missing feature)
- Range queries on text fields (slow for large datasets)
- **No popularity-based ranking** - all results shown in random/alphabetical order
- Missing critical insight: Most-sold products should appear FIRST

**Business Insight - Popularity-Based Search**:
```
SCENARIO:
Employee searches: "blusa"
Results: 50 matching products

CURRENT (Random order):
1. Blusa Verde #201 (sold 0 times this week)
2. Blusa Amarilla #089 (sold 1 time this week)
3. Blusa Rosa #045 (sold 47 times this week) ← SHOULD BE FIRST!
...

IMPROVED (Popularity-ranked):
1. Blusa Rosa #045 (sold 47 times this week) ← Most popular first!
2. Blusa Negra #033 (sold 32 times this week)
3. Blusa Blanca #012 (sold 18 times this week)
...

Why this matters:
- If 47 people bought "Blusa Rosa" this week, the 48th customer is VERY LIKELY looking for it too
- Employee finds the right product INSTANTLY (first result)
- No scrolling through 50 results
- Faster sales = shorter queue
```

---

### Problem #2: Order Finalization Time
**Impact**: CRITICAL - Employee must wait to get PDF before moving to next customer

**Current Behavior**:
- Click "Finalizar pedido" button
- System must complete ALL operations before generating PDF
- Employee cannot proceed until PDF is ready
- **CRITICAL ISSUE**: With 1 product, it took **1 MINUTE** because WiFi failed mid-transaction

**Infrastructure Reality**:
- **Unstable WiFi connection** (drops during transactions)
- No reliable/fast internet available
- Orders can fail mid-process
- Employee and customer both waiting during failures
- **Network dependency is completely blocking the business**

**Technical Analysis** (for 10-product order):
Current implementation makes **~31 sequential database operations**:

1. Stock validation loop: 10 reads (1 per product) - **SEQUENTIAL**
2. Order creation: 1 write
3. Product processing loop: **20 operations SEQUENTIAL**
   - For each of 10 products:
     - Read product again (duplicate!) - 1 read
     - Add to order subcollection - 1 write
     - Update stock - 1 write

**Bottlenecks**:
- All operations are sequential (one after another)
- Products fetched TWICE (once for validation, once for processing)
- No batching or transactions
- Each operation can fail independently
- No retry/recovery mechanism
- If WiFi drops at operation #15 of 31, entire order can be corrupted

**Mathematical Reality**:
- 31 sequential operations
- Unstable WiFi (random disconnections)
- Each operation ~200-500ms in good conditions
- Best case: 6-15 seconds
- Realistic case with retries: 30-60 seconds
- Worst case with WiFi failure: INDEFINITE (or failure)

---

### Problem #3: Inventory Race Conditions (Overselling)
**Impact**: CRITICAL - Multiple employees can oversell same product, leading to unfulfilled orders

**The Scenario**:
```
TIME: 10:00:00 - Stock in DB: Product X = 50 units

10:00:05 - Employee A: Adds 30 units to cart, clicks "Finalizar pedido"
           → Order queued in background
           → DB still shows 50 (not updated yet)

10:00:10 - Employee B: Searches Product X → Sees 50 units available!
           → Adds 25 units to cart (thinks there's plenty)
           → DB still shows 50

10:00:15 - Employee C: Views inventory dashboard → Sees 50 units!
           → Believes there's plenty of stock

10:00:20 - Background processes BOTH orders:
           → Order A: 50 - 30 = 20 ✅
           → Order B: 20 - 25 = -5 ❌ OVERSOLD BY 5 UNITS!

Result: Promised 55 units to customers but only have 50 physical units!
```

**Current System Issues**:
- Stock updates happen in BACKGROUND (async)
- Between "Finalizar pedido" click and actual DB update: 5-60 seconds
- During this window, other employees see OLD stock numbers
- Multiple employees can sell the same "last unit" simultaneously
- No stock reservation mechanism
- No real-time stock visibility across employees

**Real-World Impact**:
- Customer A and B both promised the same dress
- One customer will be disappointed (lost sale + bad reputation)
- Employee must manually check physical inventory (slow)
- Can't trust the system numbers (defeats purpose of inventory system)

---

## 🚀 GAME-CHANGING SOLUTION: QR-Based Async Order Processing

### The New Workflow (CEO's Vision)

**BEFORE** (Current - BLOCKING):
```
Employee clicks "Finalizar pedido"
    ↓
[WAITING... 30-60 seconds... WiFi fails... retry... waiting...]
    ↓
PDF generated
    ↓
Share PDF with customer
    ↓
Customer leaves
    ↓
Next customer can be served
```

**AFTER** (New - NON-BLOCKING):
```
Employee clicks "Finalizar pedido"
    ↓
IMMEDIATELY show QR code (< 100ms)
    ↓
Customer scans QR code → Goes to order status page on their phone
    ↓
Customer LEAVES THE LINE and waits elsewhere
    ↓
Employee serves NEXT customer IMMEDIATELY
    ↓
(Background) System processes order asynchronously
    ↓
Customer sees real-time progress on their phone:
  - "Processing your order... 🔄"
  - "Verifying products... ✅"
  - "Generating invoice... 📄"
  - "Order complete! 🎉"
```

### Warning
1. It's very important to understand that the employee must have the data of the total amount and the data that the customer has bought. Because he needs to read waht kind of products the employee must give to the customer.

### Why This Is Genius

1. **Unblocks Employee**: Can serve next customer immediately (no waiting)
2. **Unblocks Queue**: Customer leaves line after scanning QR
3. **Better Customer Experience**: Customer watches progress on phone (engaging)
4. **Handles Network Failures**: Background process can retry without blocking anyone
5. **Scales Infinitely**: 10 customers can be "processing" simultaneously
6. **No More Lost Sales**: Queue moves fast, customers don't leave

### Technical Implementation Strategy

#### Step 1: Generate Unique Order ID Client-Side (INSTANT)
```javascript
// Generate unique order ID without database call
const orderId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
// Example: "1704902400000-k3j2h5g9p"
```

#### Step 2: Show QR Code Immediately
```javascript
// QR code links to: https://your-domain.com/#/order-status/{orderId}
const qrCodeUrl = `${baseUrl}/#/order-status/${orderId}`;
// Generate QR code instantly (no network call)
```

#### Step 3: Customer Scans & Leaves Queue
- Customer scans QR with their phone
- Opens webpage: `/order-status/{orderId}`
- Sees initial loading state: "Processing your order..."

#### Step 4: Background Order Processing
```javascript
// Queue the order for background processing
queueOrder({
  orderId,
  customerData,
  products,
  status: 'pending'
});

// Process asynchronously with retries
processOrderInBackground(orderId);
```

#### Step 5: Real-Time Status Updates
```javascript
// Customer's phone shows real-time updates via:
// Option A: Firestore real-time listener
// Option B: Polling every 2 seconds
// Option C: Server-sent events

Status progression:
1. "pending" → Show: "Processing your order... 🔄"
2. "validating" → Show: "Verifying products... 🔍"
3. "saving" → Show: "Saving to database... 💾"
4. "generating-invoice" → Show: "Generating invoice... 📄"
5. "completed" → Show: "Order complete! 🎉 [Download PDF]"
6. "failed" → Show: "Please return to counter 🔴"
```

### Technical Architecture

#### New Files Needed:
1. **`/src/src/pages/OrderStatus/index.jsx`** - Customer-facing order status page
2. **`/src/src/services/orderQueue.js`** - Background order processing queue
3. **`/src/src/components/OrderQRCode/index.jsx`** - QR code display component
4. **`/src/src/hooks/useOrderStatus.jsx`** - Real-time order status hook

#### Modified Files:
1. **`/src/src/pages/Cart/index.jsx`** - Change "Finalizar pedido" flow
2. **`/src/src/hooks/useFirestore/index.jsx`** - Add async order processing
3. **`/src/src/context/OrderContext.jsx`** - Add order queue management

#### Database Schema Addition:
```javascript
// New "order_queue" collection
{
  orderId: "1704902400000-k3j2h5g9p",
  status: "pending" | "validating" | "saving" | "generating-invoice" | "completed" | "failed",
  customerData: {...},
  products: [...],
  createdAt: timestamp,
  updatedAt: timestamp,
  attempts: 0,
  lastError: null,
  progress: {
    step: 1,
    totalSteps: 5,
    message: "Processing your order..."
  }
}
```

---

## Firestore Query Analysis

### Search Queries (searchProductsByNameOrCode)
```javascript
// Current: 4 parallel queries per search
// Lines 421-444 in useFirestore/index.jsx

Query 1: where("name", ">=", searchTermLower) + where("name", "<", endTermLower)
Query 2: where("name", ">=", searchTermUpper) + where("name", "<", endTermUpper)
Query 3: where("productCode", ">=", searchTermLower) + where("productCode", "<", endTermLower)
Query 4: where("productCode", ">=", searchTermUpper) + where("productCode", "<", endTermUpper)
```

**Cost**: 4 document reads per search (minimum)
**Issue**: Range queries don't scale well for text search

---

### Order Creation (createOrderWithProducts)
```javascript
// Current: Sequential operations
// Lines 307-394 in useFirestore/index.jsx

// Validation loop (SEQUENTIAL)
for (const element of products) {
  await getDoc(productRef);  // Read #1 for each product
  // Stock validation
}

// Order creation
await addDoc(collection(db, "orders"), {...});

// Processing loop (SEQUENTIAL)
for (const element of products) {
  await getDoc(productRef);     // Read #2 for each product (DUPLICATE!)
  await addDoc(...);            // Write to subcollection
  await updateDoc(productRef);  // Update stock
}
```

**Cost per order** (10 products):
- 10 reads (validation)
- 1 write (order)
- 10 reads (processing - DUPLICATE)
- 10 writes (subcollection)
- 10 writes (stock updates)
- **Total: 20 reads + 21 writes = 41 operations SEQUENTIAL**

---

## Root Cause Analysis

### Primary Issue: Network Instability + Sequential Operations
- Unstable WiFi means ANY operation can fail/timeout
- Sequential operations mean one failure blocks everything
- No transaction safety means partial failures corrupt data
- Employee and customer both blocked during entire process

### Secondary Issues:
1. **Duplicate reads**: Products fetched twice unnecessarily
2. **No parallelization**: All operations wait for previous to complete
3. **No caching**: Search hits database every time
4. **No offline capability**: System completely dependent on internet
5. **No optimistic updates**: User sees nothing until everything completes
6. **No product images**: Employees can't visually identify products quickly

---

## Solution Requirements (UPDATED WITH QR STRATEGY)

### Must Have (Critical):
1. ✅ **QR-based async order processing** - Game changer for queue management
2. ✅ **Instant QR code generation** - No database dependency
3. ✅ **Real-time order status page** - Customer-facing progress tracking
4. ✅ **Background order processing queue** - Handle network failures gracefully
5. **Product images** in search results - Visual identification
6. **Failure recovery** mechanism with retry logic
7. **Client-side order ID generation** - No network call needed

### Should Have (Important):
1. **Search caching** for frequently searched products
2. **Parallel operations** where possible (batch reads/writes)
3. **Local data sync** for product catalog (IndexedDB)
4. **Progress animations** on order status page
5. **Error notifications** for failed orders (customer returns to counter)
6. **Order history** on status page (customer can reference later)

### Nice to Have:
1. **Fuzzy search** for typos
2. **Recent searches** quick access
3. **Popular products** quick add
4. **Network status indicator**
5. **Download PDF** from order status page
6. **Share order** via WhatsApp/social media
7. **Order notifications** (SMS/push when ready)

---

## 🔒 CRITICAL SOLUTION: Stock Reservation System (Amazon-Style)

### What Amazon Does

**Amazon's Inventory Strategy**:
1. **Add to cart** → Stock is "soft reserved" (held for 15 minutes)
2. **Checkout clicked** → Stock is "hard reserved" (committed immediately)
3. **Reserved stock** is NOT visible as available to other customers
4. **Reservation expires** if payment not completed within time limit
5. **Real-time updates** - all customers see accurate available stock instantly

### Solution for Reina Chura: Instant Stock Reservation

**Strategy**: Reserve stock IMMEDIATELY when "Finalizar pedido" is clicked, BEFORE showing QR code.

```javascript
WHEN: Employee clicks "Finalizar pedido"

SEQUENCE (Critical Order):
1. ✅ INSTANT: Reserve stock in Firestore (BLOCKING - must succeed)
2. ✅ INSTANT: Generate order ID
3. ✅ INSTANT: Show QR code
4. ✅ Customer scans and leaves queue
5. 🔄 BACKGROUND: Process full order (async with retries)
6. ✅ CONFIRM: Update reservation to "confirmed" or release if failed
```

### Database Schema Changes

#### Updated Product Document:
```javascript
// OLD (Current - PROBLEMATIC):
{
  id: "product-123",
  name: "Blusa Rosa",
  productCode: "#045",
  stock: 50,              // Only field used
  price: 5000
}

// NEW (With Reservation System):
{
  id: "product-123",
  name: "Blusa Rosa",
  productCode: "#045",
  stock: 50,              // Total physical stock
  reserved: 7,            // Currently reserved (pending orders)
  available: 43,          // Computed: stock - reserved (what's sellable)
  price: 5000,
  reservations: [         // Array of active reservations
    {
      orderId: "order-abc-123",
      quantity: 3,
      reservedAt: Timestamp(2026-01-10 10:05:00),
      expiresAt: Timestamp(2026-01-10 10:15:00),  // 10 min expiry
      status: "pending"    // "pending" | "confirmed" | "expired"
    },
    {
      orderId: "order-xyz-456",
      quantity: 4,
      reservedAt: Timestamp(2026-01-10 10:07:00),
      expiresAt: Timestamp(2026-01-10 10:17:00),
      status: "pending"
    }
  ]
}
```

### Implementation Details

#### Step 1: Reserve Stock Function (CRITICAL - Must be BLOCKING)
```javascript
// src/src/hooks/useFirestore/index.jsx

const reserveStockForOrder = async (orderId, products) => {
  const batch = writeBatch(db);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 min

  // First, read all products to validate availability
  const productRefs = products.map(p => doc(db, "products", p.product.id));
  const productSnaps = await Promise.all(productRefs.map(ref => getDoc(ref)));

  // Validate all products have enough AVAILABLE stock
  for (let i = 0; i < products.length; i++) {
    const productData = productSnaps[i].data();
    const requestedQty = products[i].quantity;
    const available = productData.stock - (productData.reserved || 0);

    if (available < requestedQty) {
      throw new Error(
        `Stock insuficiente para ${productData.name}. ` +
        `Disponible: ${available}, Solicitado: ${requestedQty}`
      );
    }
  }

  // All validated - now reserve atomically
  for (let i = 0; i < products.length; i++) {
    const productRef = productRefs[i];
    const product = products[i];

    batch.update(productRef, {
      reserved: increment(product.quantity),
      reservations: arrayUnion({
        orderId,
        quantity: product.quantity,
        reservedAt: now,
        expiresAt: expiresAt,
        status: "pending"
      })
    });
  }

  // Commit all reservations atomically
  await batch.commit();
  console.log(`✅ Stock reserved for order ${orderId}`);
  return true;
};
```

#### Step 2: Modified Cart "Finalizar Pedido" Flow
```javascript
// src/src/pages/Cart/index.jsx

const handleSubmit = async () => {
  const orderId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // STEP 1: Reserve stock FIRST (BLOCKING - must succeed)
    setIsLoading(true);
    await reserveStockForOrder(orderId, products);
    // ✅ Stock is now reserved, other employees see reduced availability

    // STEP 2: Show QR code immediately
    setShowQRModal(true);
    setOrderId(orderId);
    setIsLoading(false);
    // ✅ Customer can scan QR and leave queue NOW

    // STEP 3: Process order in background (NON-BLOCKING)
    queueOrderForBackgroundProcessing(orderId, order, products);

  } catch (error) {
    setIsLoading(false);
    if (error.message.includes('Stock insuficiente')) {
      alert(
        '⚠️ STOCK INSUFICIENTE\n\n' +
        'Otro empleado ya vendió este producto mientras preparabas el pedido.\n' +
        'Por favor, verifica el stock actualizado.'
      );
    } else {
      alert('Error al reservar stock. Intenta nuevamente.');
    }
  }
};
```

#### Step 3: Check Available Stock in Search/Selection
```javascript
// src/src/components/ProductSearch/index.jsx

// Display available stock (not total stock)
const getAvailableStock = (product) => {
  return product.stock - (product.reserved || 0);
};

// In render:
<span className={`stock-indicator ${getAvailableStock(product) <= 10 ? 'warning' : 'good'}`}>
  Stock Total: {product.stock}
  {product.reserved > 0 && (
    <span className="reserved-badge">
      🔒 {product.reserved} reservados
    </span>
  )}
  <strong>Disponible: {getAvailableStock(product)}</strong>
</span>

// Validation before adding to cart
const canAddToCart = (product, quantity) => {
  const available = getAvailableStock(product);
  if (quantity > available) {
    alert(`Solo hay ${available} unidades disponibles (${product.reserved} están reservadas en otros pedidos)`);
    return false;
  }
  return true;
};
```

#### Step 4: Real-Time Stock Updates (Firestore Listeners)
```javascript
// src/src/hooks/useFirestoreContext/index.jsx

// All employees see live stock updates
const useProductWithRealTimeStock = (productId) => {
  const [product, setProduct] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "products", productId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProduct({
            ...data,
            available: data.stock - (data.reserved || 0)
          });
        }
      }
    );

    return () => unsubscribe();
  }, [productId]);

  return product;
};
```

#### Step 5: Confirm Reservation After Background Processing
```javascript
// src/src/services/orderQueue.js

const confirmReservation = async (orderId, products) => {
  const batch = writeBatch(db);

  for (const product of products) {
    const productRef = doc(db, "products", product.product.id);

    batch.update(productRef, {
      // Reduce total stock (actual sale)
      stock: increment(-product.quantity),
      // Release reservation
      reserved: increment(-product.quantity),
      // Update reservation status to "confirmed"
      reservations: arrayRemove({
        orderId: orderId,
        status: "pending"
      })
    });
  }

  await batch.commit();
  console.log(`✅ Reservation confirmed for order ${orderId}`);
};
```

#### Step 6: Release Reservation on Failure
```javascript
// src/src/services/orderQueue.js

const releaseReservation = async (orderId, products) => {
  const batch = writeBatch(db);

  for (const product of products) {
    const productRef = doc(db, "products", product.product.id);

    batch.update(productRef, {
      // Return reserved units to available pool
      reserved: increment(-product.quantity),
      // Remove reservation entry
      reservations: arrayRemove({
        orderId: orderId
      })
    });
  }

  await batch.commit();
  console.log(`⚠️ Reservation released for failed order ${orderId}`);
};
```

#### Step 7: Auto-Expire Old Reservations
```javascript
// Cloud Function (or periodic client-side cleanup)

const cleanupExpiredReservations = async () => {
  const productsRef = collection(db, "products");
  const productsSnap = await getDocs(productsRef);
  const now = new Date();

  for (const productDoc of productsSnap.docs) {
    const product = productDoc.data();

    if (product.reservations && product.reservations.length > 0) {
      const expiredReservations = product.reservations.filter(
        r => r.expiresAt.toDate() < now && r.status === "pending"
      );

      if (expiredReservations.length > 0) {
        const totalExpiredQty = expiredReservations.reduce(
          (sum, r) => sum + r.quantity, 0
        );

        await updateDoc(productDoc.ref, {
          reserved: increment(-totalExpiredQty),
          reservations: product.reservations.filter(
            r => r.expiresAt.toDate() >= now || r.status !== "pending"
          )
        });

        console.log(`🧹 Cleaned ${expiredReservations.length} expired reservations for ${product.name}`);
      }
    }
  }
};

// Run every 5 minutes
setInterval(cleanupExpiredReservations, 5 * 60 * 1000);
```

### UI Mockups

#### Search Results Display:
```
┌─────────────────────────────────────────┐
│ 🔍 Blusa Rosa #045                      │
│ Color: Rosa | Talle: M                  │
│ Precio: $5,000                          │
│                                         │
│ 📦 Stock Total: 50 unidades             │
│ 🔒 Reservado: 7 unidades (procesando)   │
│ ✅ DISPONIBLE: 43 unidades              │
│                                         │
│ [AGREGAR AL CARRITO (Max: 43)]          │
└─────────────────────────────────────────┘
```

#### Inventory Dashboard View:
```
┌────────────────────────────────────────────────────┐
│ INVENTARIO - Vista en Tiempo Real                  │
├────────────────────────────────────────────────────┤
│ Producto         Stock  Reserv  Dispon  Estado    │
├────────────────────────────────────────────────────┤
│ Blusa Rosa #045    50      7      43     ✅ OK    │
│ Pantalón #012      20      0      20     ✅ OK    │
│ Camisa #089         5      5       0     ⚠️ Full  │
│ Vestido #123        2      8      -6     🔴 ERROR │
└────────────────────────────────────────────────────┘

Legend:
✅ = Stock disponible
⚠️ = Todo reservado (0 disponible)
🔴 = SOBRE-VENDIDO (reserved > stock) - INVESTIGAR!
```

#### When Stock Insufficient:
```
┌─────────────────────────────────────────┐
│         ⚠️  STOCK INSUFICIENTE           │
│                                         │
│ Producto: Blusa Rosa #045               │
│ Solicitado: 25 unidades                 │
│ Disponible: 18 unidades                 │
│                                         │
│ Motivo: 7 unidades están reservadas     │
│ en otros pedidos que se están           │
│ procesando.                             │
│                                         │
│ [Ver Pedidos Pendientes] [Entendido]   │
└─────────────────────────────────────────┘
```

### Edge Cases Handled

| Scenario | How It's Handled |
|----------|------------------|
| **2 employees click "Finalizar" at exact same time** | Firestore transaction ensures only one succeeds. Second employee gets "Stock insuficiente" error. |
| **Order fails after 20 attempts (WiFi down 20 min)** | Reservation auto-expires after 10 minutes. Stock returns to available pool. Customer notified on phone to return to counter. |
| **Employee tries to add 50 units but only 43 available** | Validation before "Finalizar pedido" button checks `available` field, shows error immediately. |
| **Reservation stuck (order never completes or fails)** | Auto-cleanup runs every 5 min, releases expired pending reservations. Admin dashboard also shows manual release option. |
| **Product oversold (reserved > stock)** | Impossible with atomic transactions. If somehow happens (manual DB edit), admin dashboard shows 🔴 alert for investigation. |
| **Employee views inventory while orders processing** | Real-time Firestore listener updates `reserved` field instantly. Employee sees accurate available stock. |
| **Customer scans QR but order fails to process** | Customer sees "Processing..." → "Failed, please return to counter". Reservation released automatically. |

### Critical Implementation Notes

#### ⚠️ BLOCKING vs NON-BLOCKING Operations

**MUST BE BLOCKING (Wait for completion before showing QR)**:
- ✅ Stock reservation
- ✅ Order ID generation

**CAN BE NON-BLOCKING (Async in background)**:
- 🔄 Full order creation
- 🔄 Stock confirmation (converting reserved → sold)
- 🔄 PDF generation

**Code Example**:
```javascript
// ❌ WRONG - Shows QR before reservation
showQRCode(orderId);
await reserveStock(orderId, products); // Too late!

// ✅ CORRECT - Reserve first, then show QR
await reserveStock(orderId, products); // Wait for this!
showQRCode(orderId); // Now safe
```

#### Network Failure During Reservation

**Scenario**: WiFi drops while reserving stock

**Solution**: Must succeed or fail atomically
```javascript
try {
  await reserveStockForOrder(orderId, products);
  // ✅ Success - safe to show QR
  showQRCode(orderId);
} catch (error) {
  // ❌ Failed - do NOT show QR, stay on cart page
  if (error.code === 'unavailable') {
    alert('Sin conexión. No se puede procesar el pedido. Intenta nuevamente.');
  } else {
    alert('Error: ' + error.message);
  }
  // Reservation was NOT created, stock unchanged
}
```

### Benefits of This Approach

1. ✅ **No Overselling**: Impossible for 2 employees to sell same unit
2. ✅ **Real-Time Visibility**: All employees see accurate stock instantly
3. ✅ **Fast Customer Experience**: Reservation takes <1 second, then customer leaves
4. ✅ **Graceful Failure**: If background processing fails, reservation auto-releases
5. ✅ **Trust in System**: Employees can rely on displayed stock numbers
6. ✅ **Amazon-Level Quality**: Industry-standard inventory management

---

## 🚨 CRITICAL: Background Operation Reliability Strategy

### The Problem: WiFi Fails in Background Too!

**Reality**: Just because we moved operations to background doesn't mean WiFi magically works. Background operations WILL fail too.

**Scenario Example**:
1. Customer scans QR, leaves queue
2. Background starts processing order
3. WiFi drops at operation #7 of 15
4. Customer waiting with phone, sees "Processing..." for 5 minutes
5. WiFi still down
6. Customer gets angry, returns to counter
7. **Order is partially saved (CORRUPTED DATA)** or completely lost

### Engineering Solutions (Must Implement ALL)

#### 1. **Local Persistent Queue (IndexedDB)**
```javascript
// Queue persists even if browser crashes or page reloads
// Order stored locally BEFORE any network call

LocalQueue in IndexedDB:
  - orderId: "123-abc"
  - orderData: {...}
  - status: "queued" | "processing" | "completed" | "failed"
  - attempts: 0
  - nextRetryAt: timestamp
  - savedToIndexedDB: true ✅
```

**Why**: If WiFi fails, order data never lost. Can retry forever.

#### 2. **Exponential Backoff Retry Strategy**
```javascript
// Don't hammer Firestore when WiFi is down
// Smart retry timing

Attempt 1: Immediate
Attempt 2: Wait 2 seconds
Attempt 3: Wait 4 seconds
Attempt 4: Wait 8 seconds
Attempt 5: Wait 16 seconds
Attempt 6: Wait 32 seconds
Attempt 7+: Wait 60 seconds (max cap)

Max attempts: 20 (= up to 20 minutes of retrying)
```

**Why**: Gives WiFi time to recover, doesn't waste battery/CPU.

#### 3. **Atomic Firestore Transactions (All-or-Nothing)**
```javascript
// ❌ WRONG (Current Implementation):
await updateStock(product1);  // ✅ Succeeds
await updateStock(product2);  // ❌ WiFi fails
// Result: CORRUPTED (product1 updated, product2 not)

// ✅ CORRECT (New Implementation):
const batch = writeBatch(db);
batch.update(product1Ref, {stock: newStock1});
batch.update(product2Ref, {stock: newStock2});
batch.set(orderRef, orderData);
await batch.commit();  // ✅ ALL succeed or ❌ ALL fail (atomic)
```

**Why**: No partial saves. Data always consistent.

#### 4. **Idempotent Operations (Safe to Retry)**
```javascript
// ❌ WRONG (Not idempotent):
stock = stock - quantity;  // If retried, subtracts twice! Data corruption!

// ✅ CORRECT (Idempotent with order ID check):
if (!orderExists(orderId)) {
  stock = stock - quantity;
}
// Retry is safe, checks if already processed
```

**Why**: Can retry infinitely without corrupting data.

#### 5. **Network Status Detection**
```javascript
// Don't waste attempts when WiFi definitely down
if (!navigator.onLine) {
  showCustomerMessage("Internet perdido. Esperando reconexión...");
  pauseRetries();
}

window.addEventListener('online', () => {
  showCustomerMessage("Reconectado. Procesando...");
  resumeRetries();
});
```

**Why**: Smarter retry logic, better user feedback.

#### 6. **Manual Retry Button + Admin Dashboard**
```javascript
// Customer sees on phone:
"⚠️ Problema de red. Reintentando automáticamente... (Intento 5/20)"
[Reintentar Ahora] button

// Employee sees on admin dashboard:
"⚠️ Pedido #123 atascado (3 minutos)"
[Forzar Reintento] [Marcar Fallido] [Liberar Reserva]
```

**Why**: Human intervention when automation isn't enough.

---

## 🎯 SMART SEARCH: Popularity-Based Ranking System

### The Problem: Finding the Right Product in 1000+ Items

**Current Situation**:
- 1000 products in catalog (and growing)
- Employee searches "blusa" → 50+ results
- Results in random or alphabetical order
- Employee scrolls through all 50 to find the right one
- Customer waiting, getting impatient

**The Insight**:
If 47 customers bought "Blusa Rosa #045" this week, the 48th customer is probably looking for the same thing. **Show it FIRST!**

### Solution: Track & Rank by Popularity

#### Database Schema Changes

**Updated Product Document**:
```javascript
// Current product structure
{
  id: "product-123",
  name: "Blusa Rosa",
  productCode: "#045",
  stock: 50,
  reserved: 7,
  price: 5000,
  imageUrl: "https://...",

  // NEW: Popularity tracking fields
  salesStats: {
    // Today's sales
    soldToday: 12,
    todayDate: "2026-01-10",

    // This week's sales (Monday-Sunday)
    soldThisWeek: 47,
    weekStartDate: "2026-01-06",

    // All-time total
    totalSoldAllTime: 523,

    // Last time this product was sold
    lastSoldAt: Timestamp(2026-01-10 15:30:00),

    // Popularity score (calculated, see below)
    popularityScore: 94.5
  }
}
```

#### Popularity Score Calculation

**Formula** (weighted by recency):
```javascript
// Weight recent sales more heavily than old sales
popularityScore = (
  soldToday * 10 +        // Today's sales worth 10 points each
  soldThisWeek * 3 +      // This week's sales worth 3 points each
  totalSoldAllTime * 0.1  // All-time sales worth 0.1 points each
)

// Example for "Blusa Rosa #045":
popularityScore = (12 * 10) + (47 * 3) + (523 * 0.1)
                = 120 + 141 + 52.3
                = 313.3

// "Blusa Verde #201" (rarely sold):
popularityScore = (0 * 10) + (0 * 3) + (5 * 0.1)
                = 0 + 0 + 0.5
                = 0.5
```

**Why this works**:
- Recent sales matter MORE (today × 10, this week × 3)
- Product trending this week appears before product sold once last year
- All-time stats prevent "flash in the pan" products from dominating

#### Implementation: Update Sales Stats on Order Confirmation

```javascript
// src/src/services/orderQueue.js

const confirmReservation = async (orderId, products) => {
  const batch = writeBatch(db);
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const weekStart = getStartOfWeek(now); // Monday of current week

  for (const product of products) {
    const productRef = doc(db, "products", product.product.id);
    const productSnap = await getDoc(productRef);
    const productData = productSnap.data();
    const salesStats = productData.salesStats || {};

    // Check if we need to reset daily counter
    const needsDailyReset = salesStats.todayDate !== today;

    // Check if we need to reset weekly counter
    const needsWeeklyReset = salesStats.weekStartDate !== weekStart;

    // Calculate new stats
    const newStats = {
      soldToday: needsDailyReset ? product.quantity : (salesStats.soldToday || 0) + product.quantity,
      todayDate: today,

      soldThisWeek: needsWeeklyReset ? product.quantity : (salesStats.soldThisWeek || 0) + product.quantity,
      weekStartDate: weekStart,

      totalSoldAllTime: (salesStats.totalSoldAllTime || 0) + product.quantity,

      lastSoldAt: now
    };

    // Calculate popularity score
    newStats.popularityScore =
      (newStats.soldToday * 10) +
      (newStats.soldThisWeek * 3) +
      (newStats.totalSoldAllTime * 0.1);

    batch.update(productRef, {
      // ... existing stock updates
      stock: increment(-product.quantity),
      reserved: increment(-product.quantity),

      // NEW: Update sales stats
      salesStats: newStats
    });
  }

  await batch.commit();
  console.log(`✅ Reservation confirmed and stats updated for order ${orderId}`);
};
```

#### Client-Side Search with Popularity Ranking

```javascript
// src/src/components/ProductSearch/index.jsx

const searchAndRankProducts = (products, searchTerm) => {
  // Step 1: Filter products by search term
  const filtered = products.filter(product => {
    const searchLower = searchTerm.toLowerCase();
    return (
      product.name.toLowerCase().includes(searchLower) ||
      product.productCode.toLowerCase().includes(searchLower) ||
      (product.color && product.color.toLowerCase().includes(searchLower)) ||
      (product.size && product.size.toLowerCase().includes(searchLower))
    );
  });

  // Step 2: Sort by popularity score (highest first)
  const sorted = filtered.sort((a, b) => {
    const scoreA = a.salesStats?.popularityScore || 0;
    const scoreB = b.salesStats?.popularityScore || 0;
    return scoreB - scoreA; // Descending order
  });

  return sorted;
};

// Usage in component:
useEffect(() => {
  if (!searchTerm.trim()) {
    setSearchResults([]);
    return;
  }

  // Search in cached products (IndexedDB)
  const cachedProducts = getCachedProducts();
  const ranked = searchAndRankProducts(cachedProducts, searchTerm);
  setSearchResults(ranked.slice(0, 20)); // Show top 20
}, [searchTerm]);
```

#### UI Display with Popularity Indicators

```javascript
// Show popularity badge in search results

<div className="search-result-item">
  <img src={product.imageUrl} alt={product.name} />

  <div className="product-info">
    <h3>{product.name}</h3>
    <span className="product-code">{product.productCode}</span>

    {/* NEW: Popularity badge */}
    {product.salesStats?.soldToday > 5 && (
      <span className="badge badge-hot">
        🔥 Vendido {product.salesStats.soldToday} veces hoy
      </span>
    )}

    {product.salesStats?.soldThisWeek > 20 && (
      <span className="badge badge-trending">
        📈 Popular esta semana
      </span>
    )}
  </div>

  <button onClick={() => addToCart(product)}>
    Agregar al Carrito
  </button>
</div>
```

#### Visual Example in UI:

```
┌─────────────────────────────────────────────────────┐
│ 🔍 Búsqueda: "blusa"                                │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ 🔥 MÁS VENDIDO HOY                          │   │
│ │ [IMG] Blusa Rosa #045                       │   │
│ │       Color: Rosa | Talle: M                │   │
│ │       🔥 Vendido 12 veces hoy               │   │
│ │       Stock: 43 disponibles                 │   │
│ │       [AGREGAR AL CARRITO]                  │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ 📈 POPULAR ESTA SEMANA                       │   │
│ │ [IMG] Blusa Negra #033                       │   │
│ │       Color: Negro | Talle: L                │   │
│ │       📈 Popular esta semana (32 vendidas)   │   │
│ │       Stock: 18 disponibles                  │   │
│ │       [AGREGAR AL CARRITO]                   │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ┌─────────────────────────────────────────────┐   │
│ │ [IMG] Blusa Blanca #012                      │   │
│ │       Color: Blanco | Talle: S               │   │
│ │       Stock: 25 disponibles                  │   │
│ │       [AGREGAR AL CARRITO]                   │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ ... (more results below)                            │
└─────────────────────────────────────────────────────┘
```

### Advanced Features

#### 1. **"Hot Products" Section**
```javascript
// Show top 5 trending products at the top of product selection page
// Before employee even searches

<div className="hot-products">
  <h2>🔥 Más vendidos hoy</h2>
  <div className="hot-products-grid">
    {hotProducts.map(product => (
      <QuickAddCard product={product} />
    ))}
  </div>
</div>
```

#### 2. **Time-Based Ranking**
```javascript
// Different ranking by time of day
// Morning (9am-12pm): Show trending products
// Afternoon (12pm-6pm): Show fastest-moving products
// Evening (6pm-9pm): Show clearance items with low stock

const getTimeBasedWeight = () => {
  const hour = new Date().getHours();

  if (hour >= 9 && hour < 12) {
    // Morning: prioritize trending
    return { today: 15, week: 5, allTime: 0.1 };
  } else if (hour >= 12 && hour < 18) {
    // Afternoon: prioritize hot items
    return { today: 20, week: 3, allTime: 0.05 };
  } else {
    // Evening: prioritize clearance
    return { today: 5, week: 2, lowStock: 50 }; // Boost low stock items
  }
};
```

#### 3. **Employee Performance Dashboard**
```javascript
// Show employees which products are selling best
// Helps them learn what customers are looking for

<div className="employee-dashboard">
  <h2>📊 Productos más vendidos hoy</h2>
  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th>Vendido hoy</th>
        <th>Stock disponible</th>
        <th>Acción</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Blusa Rosa #045</td>
        <td>🔥 12 unidades</td>
        <td>43</td>
        <td><button>Ver</button></td>
      </tr>
      <tr>
        <td>Pantalón Negro #088</td>
        <td>📈 8 unidades</td>
        <td>5 ⚠️</td>
        <td><button>Reponer stock</button></td>
      </tr>
    </tbody>
  </table>
</div>
```

### Benefits of Popularity Ranking

1. ✅ **Faster Search**: Employee finds right product in 1st result (not 20th)
2. ✅ **Better UX**: Trending products shown first = higher probability of match
3. ✅ **Inventory Insight**: See which products are selling fast (need restock)
4. ✅ **Employee Training**: New employees learn popular products automatically
5. ✅ **Cache Optimization**: Cache hot products = even faster search
6. ✅ **Business Intelligence**: Track trends over time (weekly reports)

### Data Privacy & Reset Strategy

**Daily Reset** (at midnight):
- Reset `soldToday` counter to 0
- Recalculate `popularityScore`

**Weekly Reset** (every Monday):
- Reset `soldThisWeek` counter to 0
- Recalculate `popularityScore`

**All-time stats never reset** - used for long-term trends

```javascript
// Cloud Function or scheduled task
export const resetDailyStats = functions.pubsub
  .schedule('0 0 * * *') // Every day at midnight
  .timeZone('America/Argentina/Buenos_Aires')
  .onRun(async (context) => {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    const batch = writeBatch(db);

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        'salesStats.soldToday': 0,
        'salesStats.todayDate': format(new Date(), 'yyyy-MM-dd')
      });
    });

    await batch.commit();
    console.log('✅ Daily stats reset');
  });
```

---

## Implementation Plan (Priority Order)

### Phase 1: Immediate Impact (1-2 days)
**Goal**: Unblock the queue with QR-based async processing

1. **Client-side Order ID Generation**
   - Generate unique IDs without database
   - Format: `timestamp-randomString`

2. **QR Code Component**
   - Install QR code library (qrcode.react or similar)
   - Display QR immediately after "Finalizar pedido"
   - No loading state needed

3. **Order Status Page**
   - New route: `/order-status/:orderId`
   - Show loading/progress states
   - Real-time Firestore listener for status updates

4. **Background Order Queue**
   - Create order with generated ID
   - Process in background with status updates
   - Handle failures with retry logic

5. **Modified Cart Flow**
   - Click "Finalizar pedido"
   - Generate order ID instantly
   - Show QR code modal
   - Start background processing
   - Allow employee to close modal and serve next customer

**Expected Impact**:
- Queue processing speed: 60 seconds → **5 seconds** (12x faster)
- Customer wait time: In line → Out of line (watching phone)
- Employee throughput: 1 customer/min → 10+ customers/min

---

### Phase 2: Search Optimization (2-3 days)
**Goal**: Make product search "the fastest ever"

1. **Add Product Images**
   - Upload images to Firebase Storage or CDN
   - Add imageUrl field to products collection
   - Display thumbnails in search results

2. **Local Product Cache**
   - IndexedDB for 1000+ products
   - Sync on app load / background
   - Search locally first, then Firestore

3. **Optimized Search Algorithm**
   - Client-side fuzzy search on cached data
   - Instant results (< 50ms)
   - Fallback to Firestore if not cached

4. **Visual Search UI**
   - Large product images
   - Color/size badges
   - Stock indicators
   - Quick add to cart

5. **Popularity-Based Search Ranking**
   - Track sales per product (daily/weekly counters)
   - Sort search results by popularity
   - Most-sold products appear first
   - Cache popular products for instant access

**Expected Impact**:
- Search speed: 500-1000ms → **< 50ms** (20x faster)
- Visual identification: Text-only → **Images** (much faster for employees)
- Offline capability: None → **Full offline search**
- Search relevance: Random order → **Most popular first** (employee finds product instantly)

---

### Phase 3: Database Optimization (1-2 days)
**Goal**: Reduce database operations and improve reliability

1. **Batched Writes**
   - Use Firestore batch() for all order operations
   - All writes in single transaction
   - Atomic success/failure

2. **Parallel Reads**
   - Fetch all products in parallel (Promise.all)
   - Single validation pass
   - No duplicate reads

3. **Optimized Stock Updates**
   - Use increment() for stock updates
   - No read-before-write needed

**Expected Impact**:
- Database operations: 41 ops → **~15 ops** (3x reduction)
- Order processing time: 30-60s → **5-10s** (6x faster)
- Firestore costs: High → **Much lower**
- Reliability: Partial failures possible → **All-or-nothing**

---

### Phase 4: Polish & Monitoring (1-2 days)
**Goal**: Production-ready with monitoring

1. **Error Handling**
   - Retry logic for failed operations
   - Customer notifications for failures
   - Admin dashboard for stuck orders

2. **Analytics**
   - Track order processing times
   - Monitor failure rates
   - Search performance metrics

3. **Testing**
   - Network throttling tests
   - Offline mode tests
   - Load testing (multiple simultaneous orders)

---

## Technical Debt Identified

### In ProductSearch Component (src/src/components/ProductSearch/index.jsx)
- Line 29: `searchProductsByNameOrCode(searchTerm)` - 4 queries per search
- Line 37: 500ms debounce - might be too slow for fast typers
- No image display
- No caching

### In Cart Page (src/src/pages/Cart/index.jsx)
- Line 51: `createOrderWithProducts(...)` - **BLOCKING OPERATION** (critical issue)
- Line 59: Navigate after success - no offline queue
- Lines 63-65: Poor error handling (just shows error modal)
- No retry mechanism
- **MISSING**: QR code generation and display

### In useFirestore Hook (src/src/hooks/useFirestore/index.jsx)
- Lines 313-329: Sequential stock validation (should be parallel)
- Lines 343-387: Sequential product processing (should be batched)
- Lines 317 & 347: Duplicate getDoc calls for same products
- No transaction usage (risk of partial failures)
- No retry logic
- **MISSING**: Async order processing with status updates

### In OrderContext (src/src/context/OrderContext.jsx)
- Lines 10-27: localStorage only - should use IndexedDB for larger data
- No sync mechanism between localStorage and Firestore
- Cart stored in memory - can be lost
- **MISSING**: Order queue management

---

## Additional Notes

- QR-based approach is **the key differentiator** for this business
- System needs to handle graceful degradation when offline
- Need to measure actual Firebase costs (reads/writes per day)
- Consider Firestore bundle/cache for product catalog
- Network throttling tests are CRITICAL before deployment
- Order status page should work on all mobile devices (responsive)
- Consider WhatsApp integration for order notifications (very popular in Argentina)

---

## Questions for Follow-up

1. Is there a budget for Firebase reads/writes per month?
2. Can we add product images to the database? (Critical for visual search)
3. Is there a way to improve WiFi infrastructure? (backup connection?)
4. Can we use a local router/hotspot as backup?
5. What happens if an order fails mid-creation currently? (data corruption?)
6. Do orders need to be immediately synced, or can they queue? (QR approach allows queueing)
7. Is there a time limit per customer transaction?
8. What PDF library is currently being used?
9. **NEW**: Should order status page have payment integration? (pay from phone?)
10. **NEW**: Should we send order link via WhatsApp automatically?
11. **NEW**: What happens if customer loses QR code / doesn't scan it?
12. **NEW**: Should employees have a dashboard to see all "in-progress" orders?

---

## Success Metrics

### Current State (Baseline):
- Order finalization time: 30-60 seconds (blocking)
- Search time: Unknown (not tested)
- Customers served per hour: ~60 (1 per minute max)
- Order failure rate: Unknown (high with bad WiFi)
- Customer abandonment rate: Unknown (but reported as high)

### Target State (After Implementation):
- Order finalization time: < 5 seconds (non-blocking with QR)
- Search time: < 50ms (cached, with images)
- Customers served per hour: 600+ (10 per minute, no queue bottleneck)
- Order failure rate: < 1% (with retry logic)
- Customer abandonment rate: Near 0% (queue moves fast)

### Business Impact:
- **10x more customers served per hour**
- **Zero queue bottleneck** (customers wait outside line)
- **Better customer experience** (interactive order tracking)
- **Competitive advantage** (no other stores doing this)
- **Scalable to any number of employees** (all can work simultaneously)

---

*This document will be updated as we implement solutions and gather more data.*
