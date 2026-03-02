# Stock Sync Bug Fix - Firestore No Resta Correctamente

**Creado:** 2026-01-29
**Prioridad:** 🚨 CRÍTICA

---

## 🐛 El Bug Crítico

### Síntoma

```
Firestore: alpha stock = 1000
Usuario compra 10 unidades
  ↓
IndexedDB: stock = 990 ✅ (correcto)
Firestore: stock = -10 ❌ (INCORRECTO - solo guardó el delta!)
```

### El Problema Real

**Firestore NO está restando el stock, está SOBRESCRIBIENDO con el delta**

```javascript
// Lo que intentábamos hacer:
transaction.update(productRef, {
  stock: increment(product.stockDelta) // stockDelta = -10
});

// Lo que esperábamos:
// Firestore: 1000 + increment(-10) = 990 ✅

// Lo que realmente pasaba:
// Firestore: stock = -10 ❌ (sobrescribe en vez de sumar)
```

---

## 🔍 Análisis del Problema

### Por Qué Fallaba `increment()`

El problema con `increment()` de Firestore es que:

1. **Si el documento no existe** → Crea documento con el valor del increment
   ```javascript
   increment(-10) en documento inexistente
   → Crea { stock: -10 } ❌
   ```

2. **Si usas `transaction.update()` sin leer primero** → Puede fallar silenciosamente
   ```javascript
   transaction.update(ref, { stock: increment(-10) })
   // Sin leer primero, Firestore puede no saber el valor actual
   ```

3. **Race conditions** con múltiples transacciones simultáneas

### Flujo del Bug

```
1. IndexedDB: alpha stock = 1000
2. Usuario compra 10 unidades
3. reserveStock() en IndexedDB: 1000 + (-10) = 990 ✅
4. Orden guardada con stockDelta: -10

5. syncWorker sube orden a Firestore
6. transaction.update(productRef, { stock: increment(-10) })
7. ❌ Firestore NO lee el stock actual
8. ❌ Firestore crea/sobrescribe: stock = -10

9. Resultado:
   - IndexedDB: 990 ✅
   - Firestore: -10 ❌
```

---

## ✅ La Solución

### Principio Clave

> **Firestore es la fuente de verdad (source of truth) para el stock**

Siempre debemos:
1. **Leer** el stock actual de Firestore
2. **Calcular** el nuevo stock: `firestore_stock + delta`
3. **Actualizar** con el valor calculado explícitamente

### Código Corregido

```javascript
// syncWorker.js

// ANTES (INCORRECTO):
transaction.update(productRef, {
  stock: increment(product.stockDelta) // ❌ Puede sobrescribir
});

// DESPUÉS (CORRECTO):
// 1. Leer producto en transacción
const productSnap = await transaction.get(productRef);

if (!productSnap.exists()) {
  throw new Error(`Product not found in Firestore`);
}

// 2. Obtener stock REAL de Firestore
const currentStock = Number(productSnap.data().stock) || 0;
const delta = Number(product.stockDelta);
const newStock = currentStock + delta;

console.log(`Firestore current: ${currentStock}`);
console.log(`Delta to apply: ${delta}`);
console.log(`New stock: ${newStock}`);

// 3. Validar que no sea negativo
if (newStock < 0) {
  throw new Error(`Insufficient stock: ${currentStock} + ${delta} = ${newStock}`);
}

// 4. Actualizar con valor EXPLÍCITO
transaction.update(productRef, {
  stock: newStock, // ✅ Valor calculado, no increment()
  updatedAt: serverTimestamp()
});
```

---

## 📊 Flujo Corregido

```
1. IndexedDB: alpha stock = 1000
2. Usuario compra 10 unidades
3. reserveStock() en IndexedDB: 1000 + (-10) = 990 ✅
4. Orden guardada con stockDelta: -10

5. syncWorker sube orden a Firestore
6. transaction.get(productRef) → Lee Firestore
7. Firestore stock actual: 1000
8. Calcula: 1000 + (-10) = 990
9. transaction.update({ stock: 990 })
10. ✅ Firestore actualizado: stock = 990

11. Resultado:
    - IndexedDB: 990 ✅
    - Firestore: 990 ✅
```

---

## 🧪 Testing

### Test 1: Compra Simple

```javascript
// Setup
Firestore: alpha stock = 1000

// Acción
Usuario compra 10 unidades

// Verificar
1. IndexedDB: alpha stock = 990 ✅
2. Orden pendiente con stockDelta: -10 ✅
3. Sync a Firestore
4. Console logs:
   "Firestore current: 1000"
   "Delta to apply: -10"
   "New stock: 990"
   "✅ Firestore stock updated: 1000 → 990 (-10)"
5. Firestore: alpha stock = 990 ✅
```

### Test 2: Múltiples Compras

```javascript
// Setup
Firestore: beta stock = 50

// Acción
Usuario 1 compra 5 (offline)
Usuario 2 compra 8 (offline)

// Cuando ambos sincronicen
1. syncWorker orden 1:
   - Lee Firestore: 50
   - Calcula: 50 + (-5) = 45
   - Actualiza: 45

2. syncWorker orden 2:
   - Lee Firestore: 45 (ya actualizado)
   - Calcula: 45 + (-8) = 37
   - Actualiza: 37

3. Resultado final:
   Firestore: 37 ✅ (50 - 5 - 8 = 37)
```

### Test 3: Stock Insuficiente

```javascript
// Setup
Firestore: gamma stock = 5

// Acción
Usuario intenta comprar 10

// Esperado
1. IndexedDB valida antes de crear orden: ❌ Stock insuficiente
2. No crea orden
3. Usuario ve error: "Stock insuficiente"
```

### Test 4: Producto No Existe en Firestore

```javascript
// Setup
Producto solo en IndexedDB (no sincronizado a Firestore)

// Acción
Usuario compra producto

// Esperado
1. Orden se crea en IndexedDB
2. Sync intenta subir a Firestore
3. transaction.get() → !exists()
4. Lanza error: "Product not found in Firestore"
5. Sync marca como failed
6. Retry más tarde cuando producto esté en Firestore
```

---

## 📈 Comparación: increment() vs Cálculo Explícito

### Método 1: increment() (PROBLEMÁTICO)

```javascript
// Ventajas:
✅ Código más corto
✅ Firestore maneja el incremento

// Desventajas:
❌ Puede sobrescribir si documento no existe
❌ No podemos validar stock negativo ANTES de actualizar
❌ No tenemos logs del cálculo
❌ Race conditions más difíciles de debuggear
```

### Método 2: Cálculo Explícito (CORRECTO)

```javascript
// Ventajas:
✅ Leemos Firestore primero (source of truth)
✅ Validamos stock negativo ANTES de actualizar
✅ Logs claros del cálculo
✅ Control total del proceso
✅ Fácil de debuggear

// Desventajas:
⚠️ Código más largo (pero más seguro)
```

---

## 🔒 Seguridad de Transacciones

### Por Qué Usar Transacciones

```javascript
runTransaction(firestore, async (transaction) => {
  // 1. Read
  const productSnap = await transaction.get(productRef);

  // 2. Calculate
  const newStock = productSnap.data().stock + delta;

  // 3. Write
  transaction.update(productRef, { stock: newStock });
});
```

**Garantías de Firestore:**
- ✅ **Atomicidad**: Todo succeed o todo falla
- ✅ **Aislamiento**: Otras transacciones esperan
- ✅ **Consistencia**: Stock nunca en estado inválido
- ✅ **Retry automático**: Si hay conflicto, Firestore reintenta

---

## 🎯 Orden de Operaciones

### CRÍTICO: Leer Antes de Actualizar

```javascript
// ❌ INCORRECTO (no lee primero)
transaction.update(productRef, { stock: increment(-10) });

// ✅ CORRECTO (lee, calcula, actualiza)
const snap = await transaction.get(productRef);
const current = snap.data().stock;
const newStock = current + delta;
transaction.update(productRef, { stock: newStock });
```

### Promise.all para Múltiples Productos

```javascript
// Leer TODOS los productos primero
const productSnapshots = await Promise.all(
  productReads.map(p => transaction.get(p.ref))
);

// Luego actualizar todos
for (let i = 0; i < productReads.length; i++) {
  const snap = productSnapshots[i];
  const current = snap.data().stock;
  const newStock = current + delta;
  transaction.update(productReads[i].ref, { stock: newStock });
}
```

**Por qué `Promise.all`:**
- ✅ Lee todos en paralelo (más rápido)
- ✅ Firestore agrupa lecturas
- ✅ Transacción sigue siendo atómica

---

## 📝 Logs de Debugging

### Antes del Fix

```
❌ Stock updated for Producto A: -10
   (No muestra stock actual ni cálculo)
```

### Después del Fix

```
📊 Stock calculation for Producto A:
   Firestore current: 1000
   Delta to apply: -10
   New stock: 990
✅ Firestore stock updated: 1000 → 990 (-10)
```

**Beneficios:**
- ✅ Vemos el stock REAL de Firestore
- ✅ Vemos el delta que se aplica
- ✅ Vemos el resultado calculado
- ✅ Fácil detectar errores

---

## ⚠️ Casos Edge

### 1. Orden Duplicada (Sync Doble)

```javascript
// Escenario
Orden synced exitosamente
Usuario fuerza refresh
Orden intenta syncear de nuevo

// Protección
const orderSnap = await getDoc(orderRef);
if (orderSnap.exists()) {
  console.log('Order already exists, skipping stock update');
  return { success: true, message: 'Already synced' };
}
```

### 2. Stock Cambia Entre Orden y Sync

```javascript
// Escenario
T0: Usuario ve stock = 100
T1: Usuario compra 10 (IndexedDB: 90)
T2: Admin actualiza stock a 50 en Firestore
T3: Sync orden

// Resultado
Firestore: 50 (admin actualizado)
Delta: -10
Nuevo: 50 + (-10) = 40 ✅ (correcto, usa Firestore como verdad)
```

### 3. Múltiples Devices Sincronizando

```javascript
// Escenario
Device A: Compra 5 (sync en progreso)
Device B: Compra 8 (sync en progreso)

// Firestore Transactions
Transaction A lee stock: 100
Transaction B lee stock: 100 (mismo tiempo)
Transaction A actualiza: 95
Transaction B detecta conflicto → RETRY
Transaction B lee stock: 95 (nuevo)
Transaction B actualiza: 87 ✅
```

---

## 📁 Archivo Modificado

### `src/services/syncWorker.js`

**Cambios principales:**

1. **Lectura en transacción:**
   ```javascript
   const productSnapshots = await Promise.all(
     productReads.map(p => transaction.get(p.ref))
   );
   ```

2. **Cálculo explícito:**
   ```javascript
   const currentStock = Number(productSnap.data().stock) || 0;
   const newStock = currentStock + delta;
   ```

3. **Validación:**
   ```javascript
   if (newStock < 0) {
     throw new Error(`Insufficient stock`);
   }
   ```

4. **Update con valor calculado:**
   ```javascript
   transaction.update(productRef, {
     stock: newStock, // No increment()
     updatedAt: serverTimestamp()
   });
   ```

---

## 🎯 Resultado Final

### Antes

```
Firestore: stock = 1000
Compra: 10 unidades
Firestore: stock = -10 ❌ (roto)
```

### Después

```
Firestore: stock = 1000
Compra: 10 unidades
Firestore: stock = 990 ✅ (correcto)
```

---

**Última Actualización:** 2026-01-29
**Estado:** ✅ ARREGLADO
**Impacto:** CRÍTICO - Sin esto, el stock en Firestore es inútil
