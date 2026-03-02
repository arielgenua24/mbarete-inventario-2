# Two-Way Sync Fix - Solución Crítica

**Creado:** 2026-01-29
**Prioridad:** 🚨 CRÍTICA

---

## 🚨 Problemas Críticos Identificados

### 1. DexieError: Missing `taskId`

```
DexieError: Failed to execute 'put' on 'IDBObjectStore':
Evaluating the object store's key path did not yield a value.
```

**Causa:** La tabla `syncQueue` requiere `taskId` como clave primaria, pero no lo estábamos generando.

**Solución:** ✅ Modificado `addSyncTask()` para generar `taskId` automáticamente.

---

### 2. Timestamp Comparison Roto (MUY GRAVE)

**Escenario del Bug:**

```javascript
// Estado inicial
Firestore lastUpdated: 2026-01-29T14:36:16.269Z
IndexedDB lastSynced:  2026-01-29T14:36:16.269Z
// ✅ Sincronizados

// Usuario va OFFLINE y crea 3 órdenes
// IndexedDB se actualiza localmente
IndexedDB lastSynced:  2026-01-29T14:36:46.256Z (actualizado localmente)

// Usuario vuelve ONLINE
// smartSync compara timestamps:
Remote: 2026-01-29T14:36:16.269Z
Local:  2026-01-29T14:36:46.256Z
Difference: -0.00 days (local más reciente)

// ❌ DECISIÓN INCORRECTA
console.log('✅ Already up to date')
// NO sube las 3 órdenes pendientes a Firestore
```

**Por qué es Grave:**

1. **Local adelantado ≠ Sincronizado**
   - Si local es más reciente, significa que hicimos cambios offline
   - Esos cambios DEBEN subirse a Firestore
   - El algoritmo asume "adelantado = no hay trabajo", pero es FALSO

2. **Confunde "Bajar" con "Subir"**
   - `checkForUpdates()` solo pregunta "¿necesito bajar?"
   - Nunca pregunta "¿tengo cosas que subir?"
   - Resultado: Órdenes offline NUNCA se sincronizan

3. **No hay Cola de Subida Independiente**
   - El `syncWorker` procesa `syncQueue`
   - Pero `smartSync` no llama al worker
   - Las órdenes quedan en `syncQueue` para siempre

---

## 🔧 Solución: Two-Way Sync

### Arquitectura Nueva

```
smartSync() {
  PASO 1: SUBIR ⬆️
    ├─ Revisar syncQueue (pending orders, etc.)
    ├─ Si hay tareas → forceProcessQueue()
    └─ Subir cambios locales a Firestore

  PASO 2: BAJAR ⬇️
    ├─ Comparar timestamps
    ├─ Si Firestore más reciente → deltaSync()
    └─ Bajar cambios de Firestore a IndexedDB
}
```

### Código Anterior (ROTO)

```javascript
export const smartSync = async () => {
  // ❌ Solo revisa si necesita BAJAR
  const checkResult = await checkForUpdates();

  if (!checkResult.needsSync) {
    // ❌ Ignora la cola de SUBIDA
    console.log('✅ No sync needed');
    return { success: true, skipped: true };
  }

  // ❌ Solo baja cambios, nunca sube
  if (checkResult.syncType === 'full') {
    return await fullSync();
  } else {
    return await deltaSync();
  }
};
```

### Código Nuevo (CORRECTO)

```javascript
export const smartSync = async () => {
  console.log('🧠 Running smart sync (two-way)...');

  // PASO 1: SUBIR cambios locales (CRÍTICO)
  const { getPendingSyncTasks } = await import('./cacheService');
  const pendingTasks = await getPendingSyncTasks();

  if (pendingTasks && pendingTasks.length > 0) {
    console.log(`📤 Found ${pendingTasks.length} pending tasks in upload queue`);

    // Procesar cola de subida
    const { forceProcessQueue } = await import('./syncWorker');
    await forceProcessQueue();
  }

  // PASO 2: BAJAR actualizaciones de Firestore
  const checkResult = await checkForUpdates();

  if (!checkResult.needsSync) {
    console.log('✅ No download needed');
    return { success: true };
  }

  // Bajar cambios
  if (checkResult.syncType === 'full') {
    return await fullSync();
  } else {
    return await deltaSync();
  }
};
```

---

## 📊 Flujo Completo

### Crear Orden Offline

```
1. Usuario offline crea orden
   └─ useLocalOrders.createOrder()
      ├─ Reserva stock en IndexedDB
      ├─ Guarda orden en pendingOrders
      └─ addSyncTask({ type: 'sync_order', payload: { orderId } })
         └─ syncQueue: [{ taskId: "task_123", status: "pending" }]

2. Orden queda en cola de subida
   ├─ pendingOrders: { orderId, syncStatus: "pending" }
   └─ syncQueue: { taskId, type: "sync_order", status: "pending" }
```

### Sincronización (Online)

```
3. Usuario vuelve online
   └─ syncScheduler detecta conexión
      └─ smartSync()

4. PASO 1: Subir (⬆️)
   ├─ getPendingSyncTasks()
   │  └─ Encuentra: [{ taskId: "task_123", type: "sync_order" }]
   │
   ├─ forceProcessQueue()
   │  └─ syncWorker.processQueue()
   │     └─ syncWorker.syncOrder(orderId)
   │        ├─ Obtiene orden de pendingOrders
   │        ├─ runTransaction() en Firestore
   │        │  ├─ Crea orden
   │        │  └─ Aplica stock deltas atómicamente
   │        └─ Actualiza pendingOrders.syncStatus = "synced"
   │
   └─ ✅ Órdenes subidas a Firestore

5. PASO 2: Bajar (⬇️)
   ├─ checkForUpdates()
   │  └─ Compara timestamps
   │
   ├─ Si Firestore más reciente:
   │  └─ deltaSync() o fullSync()
   │     └─ Baja productos actualizados
   │
   └─ ✅ IndexedDB actualizado
```

---

## 🔄 Dos Colas Independientes

### Cola de Subida (syncQueue)

**Propósito:** Cambios locales que deben subirse a Firestore

**Contenido:**
- Órdenes creadas offline (`sync_order`)
- Productos editados offline (`sync_product_update`)
- Cualquier cambio local pendiente

**Procesamiento:**
- `syncWorker.processQueue()` lee de `syncQueue`
- Sube cambios a Firestore usando transactions
- Marca tareas como `completed`

**Ejemplo:**
```javascript
{
  taskId: "task_1738159955123_abc123",
  type: "sync_order",
  payload: { orderId: "ORD_20260129_123235_7OI89J" },
  priority: 1,
  status: "pending",
  createdAt: "2026-01-29T15:32:35.123Z"
}
```

### Cola de Bajada (Implicit)

**Propósito:** Actualizaciones de Firestore que deben bajarse a IndexedDB

**Procesamiento:**
- `checkForUpdates()` compara timestamps
- Si Firestore más reciente → `deltaSync()` o `fullSync()`
- Baja productos actualizados

**No usa una tabla separada:**
- La "cola" es implícita (comparación de timestamps)
- Se procesa automáticamente en `smartSync`

---

## 🧪 Testing del Fix

### Test 1: Crear Orden Offline y Sincronizar

```javascript
// 1. Ve offline
DevTools → Network → Offline ✓

// 2. Crea orden
Cart → "Finalizar Pedido"

// 3. Verifica IndexedDB
syncQueue: [
  { taskId: "task_...", type: "sync_order", status: "pending" }
]
pendingOrders: [
  { orderId: "ORD_...", syncStatus: "pending" }
]

// 4. Ve online
DevTools → Network → Online ✓

// 5. Espera sync automático (10-30s)
// O fuerza sync desde /sync-debug

// 6. Verifica consola:
🧠 Running smart sync (two-way)...
📤 Found 1 pending tasks in upload queue
🔄 Processing task task_... (sync_order)
📤 Syncing order to Firestore with atomic stock updates
📊 Applying stock delta for beta: -2
✅ Order ORD_... synced to Firestore

// 7. Verifica Firestore Console:
✓ Orden existe en orders/
✓ Stock actualizado en products/
```

### Test 2: Múltiples Órdenes Offline

```javascript
// 1. Offline → Crea 3 órdenes
syncQueue: [
  { taskId: "task_1", type: "sync_order", status: "pending" },
  { taskId: "task_2", type: "sync_order", status: "pending" },
  { taskId: "task_3", type: "sync_order", status: "pending" }
]

// 2. Online → Sync automático

// 3. Verifica que TODAS se suben:
🔄 Processing 3 sync tasks...
📤 Syncing order ORD_1...
✅ Order ORD_1 synced
📤 Syncing order ORD_2...
✅ Order ORD_2 synced
📤 Syncing order ORD_3...
✅ Order ORD_3 synced
```

### Test 3: Dos Teléfonos Simultáneos

```javascript
// Teléfono A offline:
- Crea orden: 5 mangos (stock local: 33)

// Teléfono B offline:
- Crea orden: 8 mangos (stock local: 30)

// Ambos online:
// A sube primero:
📤 Syncing order ORD_A...
📊 Applying stock delta: -5
Firestore stock: 38 → 33

// B sube después:
📤 Syncing order ORD_B...
📊 Applying stock delta: -8
Firestore stock: 33 → 25

✅ Stock final correcto: 25
```

---

## 🐛 Bugs Arreglados

### 1. DexieError: Missing taskId ✅

**Antes:**
```javascript
addSyncTask({ type: "sync_order", payload: { orderId } });
// ❌ Error: taskId undefined
```

**Después:**
```javascript
addSyncTask({ type: "sync_order", payload: { orderId } });
// ✅ Genera: taskId: "task_1738159955_abc123"
```

### 2. Órdenes Offline No Se Sincronizan ✅

**Antes:**
```javascript
smartSync()
  → checkForUpdates()
  → "Already up to date"
  → ❌ Ignora syncQueue
```

**Después:**
```javascript
smartSync()
  → getPendingSyncTasks()
  → forceProcessQueue()
  → ✅ Sube órdenes pendientes
  → checkForUpdates()
  → ✅ Baja actualizaciones
```

### 3. Status Incorrecto en syncQueue ✅

**Antes:**
```javascript
getPendingSyncTasks()
  .where('status').anyOf(['queued', 'failed'])
// ❌ Nunca encuentra tareas con status: 'pending'
```

**Después:**
```javascript
getPendingSyncTasks()
  .where('status').anyOf(['pending', 'failed'])
// ✅ Encuentra todas las tareas pendientes
```

---

## 📁 Archivos Modificados

1. **`src/src/services/cacheService.js`**
   - `addSyncTask()`: Genera `taskId` automáticamente
   - `getPendingSyncTasks()`: Busca status `'pending'` en vez de `'queued'`

2. **`src/src/services/syncService.js`**
   - `smartSync()`: Two-way sync (subir + bajar)
   - Ahora procesa syncQueue ANTES de comparar timestamps

---

## ⚠️ Advertencias Importantes

### 1. No Confundir "Adelantado" con "Sincronizado"

```
❌ INCORRECTO:
if (localTimestamp > remoteTimestamp) {
  // "Estamos adelantados, no hay nada que hacer"
  return { needsSync: false };
}

✅ CORRECTO:
// Siempre revisar cola de subida PRIMERO
if (syncQueue.length > 0) {
  // Hay cambios locales que subir
  uploadChanges();
}

// LUEGO revisar si necesitamos bajar
if (remoteTimestamp > localTimestamp) {
  downloadChanges();
}
```

### 2. Dos Tipos de Sync

**Sync de Subida (Upload):**
- Procesa `syncQueue`
- Sube órdenes, cambios locales
- NO compara timestamps
- Siempre se ejecuta si hay tareas pending

**Sync de Bajada (Download):**
- Compara timestamps
- Baja productos actualizados
- Solo si Firestore más reciente

### 3. Orden Importa

```
✅ CORRECTO: Subir primero, bajar después
smartSync() {
  1. uploadQueue()   // Subir cambios locales
  2. downloadSync()  // Bajar actualizaciones
}

❌ INCORRECTO: Bajar primero
smartSync() {
  1. downloadSync()  // Podría sobrescribir cambios locales
  2. uploadQueue()
}
```

---

## 🎯 Conclusión

El problema principal era que `smartSync` solo manejaba **una dirección** (bajar de Firestore).

Ahora maneja **dos direcciones**:
1. **⬆️ Subir:** Procesa cola de tareas pendientes (órdenes offline)
2. **⬇️ Bajar:** Descarga actualizaciones de Firestore

Esto garantiza que:
- ✅ Órdenes offline se sincronizan automáticamente
- ✅ Productos actualizados se bajan a IndexedDB
- ✅ Stock deltas se aplican atómicamente
- ✅ No se pierden cambios locales

---

**Última Actualización:** 2026-01-29
**Estado:** ✅ Implementado y listo para testing
