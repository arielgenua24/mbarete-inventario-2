# Phase 4 - Cart Integration Guide

**Objetivo:** Modificar Cart.jsx para usar órdenes optimistas (instant, <100ms)

---

## 🎯 Cambios Necesarios en Cart.jsx

### **Paso 1: Importar useLocalOrders**

```javascript
// En src/src/pages/Cart/index.jsx
// CAMBIAR ESTO:
import useFirestoreContext from '../../hooks/useFirestoreContext'

// POR ESTO:
import useLocalOrders from '../../hooks/useLocalOrders'
```

### **Paso 2: Reemplazar el Hook**

```javascript
// CAMBIAR ESTO:
const { createOrderWithProducts } = useFirestoreContext()

// POR ESTO:
const { createOrder, isCreating, error: orderError } = useLocalOrders()
```

### **Paso 3: Modificar handleSubmit**

Reemplazar la función `handleSubmit` completa con esta versión optimista:

```javascript
const handleSubmit = async () => {
  // Validaciones básicas
  if (cart.length < 1) {
    setError(true);
    return null;
  }

  setIsLoading(true);

  try {
    // Preparar datos de la orden
    const orderData = {
      customerName: order.customerName,
      phone: order.phone,
      address: order.address
    };

    // Crear orden INSTANTÁNEAMENTE en IndexedDB
    const result = await createOrder(orderData, cart);

    if (result.success) {
      console.log(`✅ Orden creada en ${result.duration.toFixed(2)}ms`);

      // Limpiar carrito y navegar al QR
      resetOrderValues();
      navigate(`/succeeded-order/${result.orderId}`);
    } else {
      console.error('❌ Error:', result.error);
      setError(true);
      window.scrollTo(0, 0);
    }
  } catch (e) {
    console.error('❌ Error al crear la orden:', e);
    setError(true);
  } finally {
    setIsLoading(false);
  }
};
```

---

## 📊 Comparación: Antes vs Después

### **ANTES (Firestore directo):**
```javascript
// 30-60 segundos de espera 😴
const handleSubmit = async () => {
  setIsLoading(true);

  // ⏳ Validar stock en Firestore (5-10s)
  // ⏳ Crear orden en Firestore (5-10s)
  // ⏳ Actualizar stock de cada producto (10-40s)
  // ⏳ Crear referencias de productos (5-10s)

  const orderResultId = await createOrderWithProducts(...);

  // Cliente esperando todo este tiempo...
  setIsLoading(false);
  navigate(`/succeeded-order/${orderResultId}`);
};
```

### **DESPUÉS (Optimistic con IndexedDB):**
```javascript
// <100ms de espera ⚡
const handleSubmit = async () => {
  setIsLoading(true);

  // ✨ Validar stock LOCAL (<20ms)
  // ✨ Guardar en IndexedDB (<50ms)
  // ✨ Agregar a cola de sync (<20ms)

  const result = await createOrder(orderData, cart);

  // Cliente ve el QR INMEDIATAMENTE
  setIsLoading(false);
  navigate(`/succeeded-order/${result.orderId}`);

  // 🔄 Sync a Firestore en BACKGROUND (invisible para el cliente)
};
```

---

## 🚀 Flujo Completo

```
USUARIO HACE CLIC EN "FINALIZAR PEDIDO"
│
├─ [0-20ms] Validar stock en IndexedDB
├─ [20-50ms] Generar ID de orden único
├─ [50-80ms] Guardar en IndexedDB
├─ [80-100ms] Agregar a cola de sync
│
└─ ✅ [<100ms] MOSTRAR QR - CLIENTE SE VA
    │
    └─ (En background, invisible)
        ├─ [5-10s después] SyncWorker procesa cola
        ├─ Valida stock en Firestore
        ├─ Crea orden en Firestore
        ├─ Actualiza stock
        ├─ Marca orden como "synced"
        └─ ✅ Orden en Firestore (cliente ya se fue feliz)
```

---

## ⚠️ Consideraciones Importantes

### 1. **Validación de Stock**
- Se valida LOCALMENTE primero (rápido)
- Se valida en FIRESTORE al sincronizar (seguro)
- Si falla en Firestore → orden queda en "failed", se puede reintentar

### 2. **IDs Temporales**
- `orderId`: `ORD_20260129_153045_A7B2C3`
- `orderCode`: `TEMP_A7B2C3` (se reemplaza al sincronizar)

### 3. **Estados de Sync**
- `pending`: Guardada localmente, esperando sync
- `syncing`: Siendo enviada a Firestore
- `synced`: Exitosamente en Firestore
- `failed`: Falló, necesita retry

---

## 🧪 Cómo Testear

### Test 1: Orden Online (Normal)
1. Agregar productos al carrito
2. Llenar datos del cliente
3. Click "Finalizar Pedido"
4. **Verificar:** QR aparece en <1 segundo
5. **Verificar:** Orden aparece en Firestore después (~10s)

### Test 2: Orden Offline
1. Abrir DevTools → Network → "Offline"
2. Agregar productos al carrito
3. Llenar datos del cliente
4. Click "Finalizar Pedido"
5. **Verificar:** QR aparece igual de rápido
6. **Verificar:** Orden está en IndexedDB pendingOrders
7. Volver online
8. **Verificar:** Orden se sube automáticamente a Firestore

### Test 3: Stock Insuficiente
1. Agregar producto con stock bajo
2. Pedir más cantidad de la disponible
3. Click "Finalizar Pedido"
4. **Verificar:** Error inmediato "Stock insuficiente"

---

## 📝 Archivo Completo de Ejemplo

Si prefieres ver el archivo completo modificado, revisa:
`src/src/pages/Cart/index_OPTIMISTIC.jsx` (próximo a crear)

---

**Próximos Pasos:**
1. Modificar Cart.jsx según esta guía
2. Testear flujo completo
3. Verificar que syncWorker sube las órdenes
4. Celebrar las órdenes instantáneas 🎉
