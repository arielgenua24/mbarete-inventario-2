# Sistema de Stock con Operaciones Delta

**Creado:** 2026-01-29
**Estado:** Implementado

---

## 🎯 Problema Resuelto

### Escenario Sin Delta System (PROBLEMA):

```
Teléfono A (offline): Stock local = 38
  └─> Vende 5 unidades
  └─> Actualiza local: stock = 33
  └─> Al sincronizar dice: "El stock es 33"

Teléfono B (offline): Stock local = 38
  └─> Vende 8 unidades
  └─> Actualiza local: stock = 30
  └─> Al sincronizar dice: "El stock es 30"

CONFLICTO en Firestore:
  - ¿Quién gana? Si A dice "quedan 33" y B dice "quedan 30"
  - Resultado: Se pierden ventas, stock incorrecto
```

### Escenario Con Delta System (SOLUCIÓN):

```
Teléfono A (offline): Stock local = 38
  └─> Vende 5 unidades
  └─> Reserva stock localmente: 38 - 5 = 33
  └─> Guarda delta: -5
  └─> Al sincronizar dice: "Vendí 5" (delta: -5)

Teléfono B (offline): Stock local = 38
  └─> Vende 8 unidades
  └─> Reserva stock localmente: 38 - 8 = 30
  └─> Guarda delta: -8
  └─> Al sincronizar dice: "Vendí 8" (delta: -8)

Firestore (ATOMIC TRANSACTION):
  - Stock inicial: 38
  - Aplica delta de A: 38 + (-5) = 33
  - Aplica delta de B: 33 + (-8) = 25
  - ✅ Stock final correcto: 25
```

---

## 🔧 Arquitectura del Sistema

### 1. Reserva de Stock Local (IndexedDB)

Cuando se crea una orden **offline**:

```javascript
// Paso 1: Validar stock disponible
const currentProduct = await getProduct(productId);
if (currentProduct.stock < quantityRequested) {
  throw new Error('Insufficient stock');
}

// Paso 2: Reservar stock localmente (disminuir)
await applyStockDelta(productId, -quantityRequested);
// Ejemplo: 38 - 5 = 33 (queda en IndexedDB)

// Paso 3: Guardar orden con delta
const order = {
  orderId: "ORD_...",
  products: [{
    productId: "prod_123",
    quantity: 5,
    stockDelta: -5  // 👈 CRÍTICO: Guardar el cambio, no el estado final
  }]
};

await savePendingOrder(order);
```

**Beneficios:**
- ✅ El stock local se reduce inmediatamente (no se puede vender el mismo producto 2 veces)
- ✅ La orden guarda el **delta** (cuánto vendimos), no el estado final
- ✅ Si hay 3 órdenes offline, cada una reduce el stock local correctamente

### 2. Sincronización Atómica a Firestore

Cuando el dispositivo vuelve **online**:

```javascript
// Firestore Transaction (ATOMIC)
await runTransaction(firestore, async (transaction) => {
  // 1. Crear la orden
  transaction.set(orderRef, orderData);

  // 2. Aplicar deltas de stock ATÓMICAMENTE
  for (const product of order.products) {
    const productRef = doc(firestore, 'products', product.productId);

    // increment() es ATÓMICO - Firestore lo maneja correctamente
    transaction.update(productRef, {
      stock: increment(product.stockDelta)  // -5, -8, etc.
    });
  }
});
```

**Firestore `increment()` es ATÓMICO:**
- Si 10 dispositivos reportan deltas simultáneamente
- Firestore los procesa **uno por uno** automáticamente
- No hay race conditions
- No se pierden actualizaciones

---

## 📊 Flujo Completo

### Crear Orden Offline

```
Usuario: "Quiero comprar 5 Mangos"
  ↓
1. Validar stock en IndexedDB
   currentStock = 38 ✅
   requested = 5 ✅

2. Reservar stock localmente
   38 - 5 = 33 (IndexedDB)

3. Crear orden con delta
   {
     orderId: "ORD_20260129_120000_ABC123",
     products: [{
       productId: "mango_123",
       quantity: 5,
       stockDelta: -5  👈 DELTA, no estado final
     }],
     syncStatus: "pending"
   }

4. Agregar a sync queue
   syncQueue: [
     { type: "sync_order", payload: { orderId: "..." } }
   ]
```

### Sincronizar a Firestore (Online)

```
syncWorker detecta conexión
  ↓
1. Obtener orden pendiente
   order = getPendingOrders()

2. Iniciar transacción Firestore
   runTransaction(firestore, async (transaction) => {

     // Crear orden
     transaction.set(orderRef, orderData)

     // Aplicar deltas ATÓMICAMENTE
     for (product of order.products) {
       transaction.update(productRef, {
         stock: increment(product.stockDelta)  // -5
       })
     }
   })

3. Actualizar metadata
   catalog.lastUpdated = now()

4. Marcar orden como synced
   order.syncStatus = "synced"
```

---

## 🔒 Prevención de Conflictos

### Problema: Múltiples Dispositivos Offline

```
📱 Teléfono A (offline): Stock local = 38
   - Orden 1: Vende 5 (stock local: 33)
   - Orden 2: Vende 10 (stock local: 23)
   - Orden 3: Vende 8 (stock local: 15)

📱 Teléfono B (offline): Stock local = 38
   - Orden 4: Vende 7 (stock local: 31)
   - Orden 5: Vende 12 (stock local: 19)
```

**Cuando ambos se conectan:**

```javascript
// Firestore recibe 5 transacciones con deltas:
// Orden 1: -5
// Orden 2: -10
// Orden 3: -8
// Orden 4: -7
// Orden 5: -12

// Firestore aplica ATÓMICAMENTE:
38 - 5 - 10 - 8 - 7 - 12 = -4 ❌ (stock negativo!)
```

**¿Qué pasa si el stock se vuelve negativo?**

### Opción 1: Rechazar en Firestore (RECOMENDADO)

```javascript
await runTransaction(firestore, async (transaction) => {
  const productSnap = await transaction.get(productRef);
  const currentStock = productSnap.data().stock;
  const newStock = currentStock + stockDelta;

  if (newStock < 0) {
    throw new Error(`Insufficient stock in Firestore: ${currentStock} available, trying to apply delta ${stockDelta}`);
  }

  transaction.update(productRef, {
    stock: increment(stockDelta)
  });
});
```

Si falla:
- La orden se marca como `syncStatus: "failed"`
- Se puede mostrar al empleado: "Esta orden no pudo sincronizarse, stock insuficiente"
- El administrador debe resolverlo manualmente

### Opción 2: Permitir Stock Negativo (NO RECOMENDADO)

- Permitir que el stock se vuelva negativo temporalmente
- El administrador corrige manualmente después
- **Problema:** Puede causar overselling

---

## 💾 Estructura de Datos

### Orden en IndexedDB

```javascript
{
  orderId: "ORD_20260129_120000_ABC123",
  orderCode: "ABC123",
  customerName: "Cliente sin nombre",
  phone: "Sin teléfono",
  address: "Sin dirección",
  products: [
    {
      productId: "mango_123",
      productSnapshot: {
        name: "Mango Orgánico",
        price: 50,
        productCode: "PRD001"
      },
      quantity: 5,
      stockDelta: -5,  // 👈 CRÍTICO
      subtotal: 250
    }
  ],
  totalAmount: 250,
  status: "pending",
  createdAt: "2026-01-29T12:00:00.000Z",
  syncStatus: "pending",  // pending | syncing | synced | failed
  attempts: 0
}
```

### Orden en Firestore (después de sync)

```javascript
{
  orderCode: "ABC123",
  customerName: "Cliente sin nombre",
  phone: "Sin teléfono",
  address: "Sin dirección",
  products: [
    {
      productId: "mango_123",
      productSnapshot: {
        name: "Mango Orgánico",
        price: 50,
        productCode: "PRD001"
      },
      quantity: 5,
      stockDelta: -5,  // 👈 Se mantiene para auditoría
      subtotal: 250
    }
  ],
  totalAmount: 250,
  status: "pending",
  createdAt: Timestamp,  // serverTimestamp()
  syncedAt: Timestamp    // serverTimestamp()
}
```

### Producto en Firestore (después de sync)

```javascript
{
  id: "mango_123",
  name: "Mango Orgánico",
  price: 50,
  stock: 33,  // 38 - 5 (aplicado atómicamente)
  updatedAt: Timestamp  // serverTimestamp()
}
```

---

## 🧪 Testing

### Test 1: Crear orden offline

```javascript
1. Crear orden con 5 mangos
2. Verificar IndexedDB:
   - products.stock = 33 (38 - 5)
   - pendingOrders[0].products[0].stockDelta = -5
   - pendingOrders[0].syncStatus = "pending"
```

### Test 2: Sincronizar orden

```javascript
1. Ir online
2. Esperar sync automático (10-30s)
3. Verificar Firestore:
   - orders/ORD_... existe
   - products/mango_123.stock = 33
4. Verificar IndexedDB:
   - pendingOrders[0].syncStatus = "synced"
```

### Test 3: Múltiples órdenes offline

```javascript
1. Ir offline
2. Crear 3 órdenes:
   - Orden A: 5 mangos
   - Orden B: 10 mangos
   - Orden C: 8 mangos
3. Verificar IndexedDB:
   - products.stock = 15 (38 - 5 - 10 - 8)
4. Ir online
5. Esperar sync
6. Verificar Firestore:
   - products/mango_123.stock = 15 ✅
```

### Test 4: Conflicto de stock (2 teléfonos)

```javascript
Teléfono A:
1. Stock local = 10
2. Crear orden: 8 mangos (stock local: 2)

Teléfono B:
1. Stock local = 10
2. Crear orden: 7 mangos (stock local: 3)

Ambos online:
1. Firestore: 10 - 8 - 7 = -5 ❌
2. Una de las transacciones DEBE fallar
3. Verificar que una orden queda como "failed"
```

---

## 📈 Ventajas del Sistema Delta

1. **Atomic Updates:**
   - Firestore `increment()` es atómico
   - No hay race conditions
   - No se pierden actualizaciones

2. **Auditoría:**
   - Cada orden guarda el delta aplicado
   - Se puede reconstruir el historial de stock

3. **Conflict Resolution:**
   - Firestore maneja concurrencia automáticamente
   - No necesitamos lógica compleja de merge

4. **Offline-First:**
   - Stock se reserva localmente inmediatamente
   - No se puede vender el mismo stock 2 veces en el mismo dispositivo

5. **Scalable:**
   - Funciona con 1 dispositivo o 100 dispositivos
   - Firestore transactions escalan automáticamente

---

## 🚨 Limitaciones y Consideraciones

### 1. Stock Negativo

**Problema:** Si varios dispositivos venden más de lo disponible, el stock puede volverse negativo.

**Soluciones:**
- **Opción A:** Rechazar transacción en Firestore si stock < 0
- **Opción B:** Permitir negativo y que admin corrija manualmente
- **Opción C:** Sistema de reservas con timeouts (futuro)

### 2. Sincronización Retrasada

**Problema:** Si un dispositivo se mantiene offline por días, el stock local puede estar muy desactualizado.

**Soluciones:**
- Mostrar advertencia si última sincronización > 24 horas
- Sincronización obligatoria al inicio del día

### 3. Firestore Transaction Limits

**Problema:** Firestore limita a 500 operaciones por transacción.

**Solución:** Si una orden tiene >500 productos (poco probable), dividir en múltiples transacciones.

---

## 🔄 Rollback en Caso de Fallo

Si la sincronización falla:

```javascript
try {
  await syncOrder(orderId);
} catch (error) {
  // Marcar orden como failed
  await updatePendingOrder(orderId, {
    syncStatus: "failed",
    lastError: error.message
  });

  // OPCIONAL: Liberar stock localmente
  // (solo si queremos permitir reventa)
  for (const product of order.products) {
    await applyStockDelta(product.productId, -product.stockDelta);
    // -(-5) = +5 (devolver stock)
  }
}
```

---

## 📝 Archivos Modificados

1. **`src/src/services/cacheService.js`**
   - Añadido: `applyStockDelta()` - Aplica cambios de stock
   - Añadido: `reserveStock()` - Reserva stock para múltiples productos

2. **`src/src/hooks/useLocalOrders/index.jsx`**
   - Modificado: `createOrder()` - Llama a `reserveStock()` antes de guardar
   - Añadido: `stockDelta` en cada producto de la orden

3. **`src/src/services/syncWorker.js`**
   - Modificado: `syncOrder()` - Usa `runTransaction()` con `increment()`
   - Aplica deltas atómicamente en Firestore

---

**Última Actualización:** 2026-01-29
**Estado:** Implementado y listo para testing
