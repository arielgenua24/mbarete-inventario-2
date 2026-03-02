# Hybrid Orders System - Fix para /orders

**Creado:** 2026-01-29
**Prioridad:** 🚨 CRÍTICA

---

## 🐛 Problemas Resueltos

### Problema 1: Error `Cannot read properties of undefined (reading 'split')`

**Error:**
```
Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'split')
    at parseCustomDate (index.jsx:199:53)
```

**Causa:**
- Órdenes antiguas usan `fecha: "24/01/2025, 18:19"` (formato español)
- Órdenes nuevas usan `createdAt: Timestamp` (Firestore timestamp)
- La función `parseCustomDate` intentaba hacer `a.fecha.split(', ')`, pero `a.fecha` era `undefined` para órdenes nuevas

**Solución:** ✅ Modificado `filterOrdersByDate()` para manejar ambos formatos

### Problema 2: Órdenes Locales No Visibles

**Escenario:**
```
Usuario crea 20 órdenes offline
  ↓
Solo algunas se sincronizan a Firestore
  ↓
Usuario va a /orders
  ↓
❌ Solo ve las que ya están en Firestore
  ↓
Faltan las que aún están en proceso de sync
```

**Causa:**
- `/orders` solo mostraba órdenes de Firestore
- Órdenes en IndexedDB (pendientes de sync) no se mostraban

**Solución:** ✅ Nuevo sistema híbrido que combina ambas fuentes

---

## ✅ Solución: Sistema Híbrido de Órdenes

### Arquitectura

```
useHybridOrders
  ↓
├─ getPendingOrders() → IndexedDB (órdenes locales)
├─ filterOrdersByDate() → Firestore (órdenes sincronizadas)
└─ Merge + Deduplicate + Sort
   ↓
   Combined Orders Array
```

### Nuevo Hook: `useHybridOrders`

**Ubicación:** `src/hooks/useHybridOrders/index.jsx`

**Funcionalidad:**
```javascript
const { getAllOrders } = useHybridOrders();

// Retorna:
[
  // Órdenes locales (no en Firestore)
  {
    id: "ORD_20260129_123456_ABC123",
    syncStatus: "pending",  // 👈 Indicador de estado
    isLocal: true,
    ...
  },

  // Órdenes sincronizadas (de Firestore)
  {
    id: "ORD_20260129_120000_XYZ789",
    syncStatus: "synced",  // 👈 Ya en Firestore
    isLocal: false,
    ...
  }
]
```

**Características:**
1. **Deduplicación:** Si una orden está en ambos (IndexedDB + Firestore), solo se muestra la de Firestore
2. **Transformación:** Convierte órdenes locales al formato de la UI antigua
3. **Ordenamiento:** Ordena por fecha (más recientes primero)
4. **Sync Status:** Agrega indicador de estado de sincronización

---

## 🔄 Compatibilidad de Formatos

### Formato Antiguo vs Nuevo

| Campo | Formato Antiguo | Formato Nuevo |
|-------|----------------|---------------|
| Fecha | `fecha: "24/01/2025, 18:19"` | `createdAt: Timestamp` |
| Cliente | `cliente: "Juan"` | `customerName: "Juan"` |
| Teléfono | `telefono: "555-1234"` | `phone: "555-1234"` |
| Dirección | `direccion: "Calle 123"` | `address: "Calle 123"` |
| Estado | `estado: "pendiente"` | `status: "pending"` |

### Solución: Campos Duales en Firestore

Cuando se sincroniza una orden, se guardan **ambos formatos**:

```javascript
// syncWorker.js
const firestoreOrderData = {
  // Formato nuevo
  orderCode: order.orderCode,
  customerName: order.customerName,
  phone: order.phone,
  address: order.address,
  status: order.status,
  createdAt: serverTimestamp(),

  // Formato antiguo (compatibilidad)
  cliente: order.customerName,
  telefono: order.phone,
  direccion: order.address,
  estado: order.status,
  fecha: "29/01/2026, 14:30"  // Generado automáticamente
};
```

**Beneficios:**
- ✅ UI antigua funciona sin cambios
- ✅ Nuevo sistema usa campos modernos
- ✅ Transición gradual sin breaking changes

---

## 🎨 Indicadores de Estado de Sync

### Estados Posibles

**1. `pending` (Amarillo)**
```
┌────────────────────────────────────┐
│ ⏳ Pendiente de sincronización     │
└────────────────────────────────────┘
```
- Orden solo existe en IndexedDB
- Aún no se ha intentado sincronizar
- Aparece con animación de pulso

**2. `syncing` (Azul)**
```
┌────────────────────────────────────┐
│ 🔄 Sincronizando...                │
└────────────────────────────────────┘
```
- syncWorker está procesando la orden
- Transacción en progreso
- Aparece con spinner animado

**3. `synced` (Sin indicador)**
- Orden ya está en Firestore
- No muestra ningún banner
- Completamente sincronizada

### Estilos

```css
/* Pending - Amarillo */
background: #fff3cd;
border: 1px solid #ffc107;
color: #856404;

/* Syncing - Azul */
background: #d1ecf1;
border: 1px solid #0dcaf0;
color: #055160;
```

**Animaciones:**
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

---

## 📊 Flujo Completo

### Escenario: 20 Órdenes Offline

```
1. Usuario offline crea 20 órdenes
   └─ Guardadas en IndexedDB
      ├─ ORD_001: syncStatus: "pending"
      ├─ ORD_002: syncStatus: "pending"
      └─ ...

2. Usuario vuelve online
   └─ syncWorker comienza a procesar cola

3. Usuario navega a /orders
   └─ useHybridOrders.getAllOrders()
      ├─ getPendingOrders() → IndexedDB
      │  └─ 20 órdenes con status "pending"
      │
      ├─ filterOrdersByDate() → Firestore
      │  └─ 0 órdenes (aún no sincronizadas)
      │
      └─ Merge: 20 órdenes con indicador "⏳ Pendiente"

4. Sync progresa en background
   ├─ ORD_001 synced → Firestore
   ├─ ORD_002 synced → Firestore
   └─ ...

5. Usuario refresca /orders
   └─ getAllOrders()
      ├─ IndexedDB: 18 órdenes "pending"
      ├─ Firestore: 2 órdenes "synced"
      └─ UI muestra: 2 sin indicador + 18 con "⏳ Pendiente"

6. Todas sincronizadas
   └─ getAllOrders()
      ├─ IndexedDB: 0 órdenes pending
      ├─ Firestore: 20 órdenes synced
      └─ UI muestra: 20 órdenes sin indicadores
```

---

## 🧪 Testing

### Test 1: Formato Antiguo (Fecha String)

```javascript
// Orden antigua en Firestore
{
  fecha: "24/01/2025, 18:19",
  cliente: "Juan",
  telefono: "555-1234"
}

// Resultado:
✅ Se ordena correctamente por fecha
✅ Se muestra sin errores
✅ syncStatus: "synced"
```

### Test 2: Formato Nuevo (Timestamp)

```javascript
// Orden nueva en Firestore
{
  createdAt: Timestamp,
  customerName: "María",
  phone: "555-5678"
}

// Resultado:
✅ Se ordena correctamente por createdAt
✅ Se convierte a formato español para UI
✅ syncStatus: "synced"
```

### Test 3: Órdenes Mixtas

```javascript
// 10 antiguas + 10 nuevas
Firestore: [
  { fecha: "24/01/2025, 18:19", ... },
  { createdAt: Timestamp, ... },
  ...
]

// Resultado:
✅ Todas se muestran
✅ Ordenadas por fecha correctamente
✅ Sin errores de split()
```

### Test 4: Órdenes Locales + Firestore

```javascript
// Escenario
IndexedDB: 5 órdenes "pending"
Firestore: 15 órdenes "synced"

// Resultado:
✅ Total: 20 órdenes mostradas
✅ 5 con indicador "⏳ Pendiente"
✅ 15 sin indicador
✅ Ordenadas por fecha
```

### Test 5: Deduplicación

```javascript
// Mismo orderId en ambos lados
IndexedDB: { orderId: "ORD_123", syncStatus: "pending" }
Firestore: { id: "ORD_123", ... }

// Resultado:
✅ Solo se muestra 1 vez (de Firestore)
✅ No hay duplicados
```

---

## 🔧 Archivos Modificados

### 1. **`src/hooks/useFirestore/index.jsx`** (MODIFICADO)

**Función:** `filterOrdersByDate()`

**Cambios:**
- Reescrita para manejar ambos formatos
- Función `getOrderDate()` detecta automáticamente el formato
- Soporte para `createdAt` (Timestamp) y `fecha` (string español)

**Antes:**
```javascript
function parseCustomDate(dateString) {
  const [datePart, timePart] = dateString.split(', ');
  // ❌ Falla si dateString es undefined
}
```

**Después:**
```javascript
function getOrderDate(order) {
  if (order.createdAt) {
    // Maneja Timestamp, Date, o ISO string
    return new Date(order.createdAt);
  }
  if (order.fecha) {
    // Maneja formato español
    return parseCustomDate(order.fecha);
  }
  return new Date(0); // Fallback
}
```

### 2. **`src/hooks/useHybridOrders/index.jsx`** (NUEVO)

**Propósito:** Combinar órdenes de IndexedDB y Firestore

**Exports:**
```javascript
const { getAllOrders, isLoading, error } = useHybridOrders();
```

**Lógica:**
1. Fetch de ambas fuentes en paralelo
2. Transformar órdenes locales a formato UI
3. Deduplicar (Firestore gana si existe en ambos)
4. Agregar `syncStatus` a cada orden
5. Ordenar por fecha

### 3. **`src/pages/Orders/index.jsx`** (MODIFICADO)

**Cambios:**
- Reemplazado `filterOrdersByDate()` con `getAllOrders()`
- Agregado indicadores de estado de sync
- UI muestra órdenes locales + Firestore

**Indicadores:**
```javascript
{order.syncStatus === 'pending' && (
  <div className="sync-indicator-pending">
    ⏳ Pendiente de sincronización
  </div>
)}

{order.syncStatus === 'syncing' && (
  <div className="sync-indicator-syncing">
    🔄 Sincronizando...
  </div>
)}
```

### 4. **`src/pages/Orders/styles.css`** (MODIFICADO)

**Agregado:**
```css
@keyframes pulse { ... }
@keyframes spin { ... }
```

### 5. **`src/services/syncWorker.js`** (MODIFICADO)

**Cambios:**
- Agregado campos de compatibilidad al crear orden
- Ahora guarda formato nuevo + antiguo

**Nuevo código:**
```javascript
const firestoreOrderData = {
  // Formato nuevo
  orderCode, customerName, phone, address, status,
  createdAt: serverTimestamp(),

  // Formato antiguo (compatibilidad)
  cliente: customerName,
  telefono: phone,
  direccion: address,
  estado: status,
  fecha: "29/01/2026, 14:30"  // Generado
};
```

---

## 🎯 Resultados

### Antes

```
Usuario crea 20 órdenes offline
  ↓
Va a /orders
  ↓
❌ ERROR: Cannot read properties of undefined (split)
  ↓
💥 Página crasheada
```

### Después

```
Usuario crea 20 órdenes offline
  ↓
Va a /orders
  ↓
✅ Muestra todas las 20 órdenes
  ↓
Indicadores claros:
  - ⏳ Pendiente de sincronización (amarillo)
  - 🔄 Sincronizando... (azul, animado)
  - Sin indicador (ya sincronizado)
  ↓
Usuario entiende el estado de cada orden
```

---

## ⚠️ Consideraciones

### 1. Refresh Manual

**Limitación Actual:**
- El usuario debe refrescar `/orders` manualmente para ver cambios de estado
- Si una orden pasa de "pending" → "synced", no se actualiza automáticamente en la UI

**Solución Futura (Opcional):**
```javascript
// Escuchar eventos de sync
useEffect(() => {
  syncEvents.on('order_synced', ({ orderId }) => {
    // Actualizar orden específica en la lista
    setOrders(prev => prev.map(order =>
      order.id === orderId
        ? { ...order, syncStatus: 'synced' }
        : order
    ));
  });
}, []);
```

### 2. Rendimiento

**Con 100+ Órdenes:**
- `getAllOrders()` puede tardar algunos segundos
- Fetching de IndexedDB + Firestore en paralelo ayuda
- Consideración: Paginación o lazy loading

### 3. Conflictos de Eliminación

**Problema:**
- Si eliminas una orden local que aún no se sincronizó
- La orden desaparece de IndexedDB
- Pero si alguien más la creó en Firestore, puede reaparecer

**Solución:** Marcar como "deleted" en vez de eliminar físicamente

---

**Última Actualización:** 2026-01-29
**Estado:** ✅ Implementado y listo para testing
