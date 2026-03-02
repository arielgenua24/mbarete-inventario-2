# Implementation Strategy - Reina Chura Offline-First Architecture
**Date**: 2026-01-26
**Project**: Reina Chura - Sistema de Inventario y Pedidos con Arquitectura Híbrida
**Location**: Avellaneda, Buenos Aires

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Contexto del Problema](#contexto-del-problema)
3. [Arquitectura Propuesta](#arquitectura-propuesta)
4. [Sistema de Sincronización con Timestamps](#sistema-de-sincronización-con-timestamps)
5. [Flujos Detallados](#flujos-detallados)
6. [Plan de Implementación por Fases](#plan-de-implementación-por-fases)
7. [Casos Edge y Manejo de Conflictos](#casos-edge-y-manejo-de-conflictos)
8. [Testing Strategy](#testing-strategy)
9. [Métricas de Éxito](#métricas-de-éxito)
10. [Contingencias](#contingencias)

---

## RESUMEN EJECUTIVO

### Problema Central
La aplicación actual depende completamente de conexión WiFi estable para:
- Buscar productos (4 consultas Firestore por búsqueda)
- Crear pedidos (30+ operaciones secuenciales bloqueantes)
- Validar stock en tiempo real

Con WiFi intermitente e impredecible, esto causa:
- Empleados bloqueados esperando 30-60 segundos por pedido
- Clientes abandonando la cola
- Sobreventa de productos (race conditions entre empleados)
- Búsquedas lentas (500ms-2s por búsqueda)

### Solución Propuesta
Arquitectura "offline-first" con sincronización incremental basada en timestamps:

**Principios clave:**
1. **El empleado NUNCA espera al WiFi** - Todo se guarda primero localmente
2. **Sincronización inteligente en background** - Solo descarga lo que cambió
3. **Cliente sale de la cola inmediatamente** - QR code para tracking asíncrono
4. **Validación optimista con rollback** - Si falla, se deshace automáticamente

**Impacto esperado:**
- Tiempo de creación de pedido: 30-60s → **< 100ms** (600x más rápido)
- Tiempo de búsqueda: 500-2000ms → **< 50ms** (40x más rápido)
- Throughput: 1 cliente/min → **10+ clientes/min** (10x más throughput)
- Confiabilidad: ~70% → **95%+** (funciona incluso offline)

---

## CONTEXTO DEL PROBLEMA

### Arquitectura Actual (Estado Base)

**Frontend:**
- React 18.3 + Vite 6.0
- React Router v7.1.1
- Context API para gestión de estado (FirestoreContext + OrderContext)
- localStorage para persistir carrito

**Backend:**
- Firebase Firestore (todas las consultas directas, sin caché)
- Firebase Auth para autenticación

**Flujo actual de creación de pedido:**
1. Empleado busca productos → 4 consultas a Firestore por búsqueda
2. Agrega al carrito → guardado en localStorage
3. Click "Finalizar pedido" → **BLOQUEO** hasta completar:
   - Validar stock de cada producto (10 reads secuenciales)
   - Crear documento de orden (1 write)
   - Crear subcolección de productos (10 writes)
   - Actualizar stock de cada producto (10 writes)
   - **Total: 20 reads + 21 writes = 41 operaciones secuenciales**
4. Si WiFi falla en cualquier punto → ERROR, empleado debe reintentar
5. Cliente esperando todo este tiempo en la cola

**Limitaciones críticas identificadas:**

1. **Búsqueda ineficiente:**
   - 4 consultas paralelas por cada búsqueda (name upper/lower, code upper/lower)
   - Sin paginación en resultados de búsqueda
   - Sin caché, cada reload descarga productos nuevamente
   - Sin ranking por popularidad

2. **Dependencia total del WiFi:**
   - Operaciones bloqueantes
   - Sin retry automático
   - Sin cola de sincronización
   - Sin soporte offline

3. **Race conditions:**
   - 2 empleados pueden vender el mismo stock simultáneamente
   - Stock solo se valida al crear pedido, no al agregar al carrito
   - Sin sistema de reservas

4. **Problemas de escalabilidad:**
   - useFirestore hook hace TODO (800+ líneas)
   - Lógica mezclada: CRUD + búsqueda + validación + stock
   - Sin separación de capas (servicios, caché, etc)

### Por Qué Necesitamos Cambiar

**Realidad del negocio:**
- Ubicación: Avellaneda (zona de alta competencia)
- Factor crítico: Velocidad de servicio
- Si cliente espera > 2 minutos → se va a la competencia
- WiFi intermitente e impredecible (falla incluso en operaciones cortas)
- 3-5 empleados trabajando simultáneamente en hora pico
- 1000+ productos en catálogo (creciendo)

**No podemos:**
- Confiar en que el WiFi funcionará
- Hacer esperar al cliente mientras sincronizamos
- Perder ventas por búsquedas lentas
- Sobrevender productos

**Debemos:**
- Funcionar incluso completamente offline
- Responder en < 100ms para cualquier acción del empleado
- Sincronizar inteligentemente cuando hay conexión
- Prevenir sobreventa con validación local

---

## ARQUITECTURA PROPUESTA

### Principio Fundamental: "Offline-First"

**Definición:**
La aplicación funciona primero con datos locales, sincroniza con el servidor en background cuando es posible, y maneja conflictos de manera inteligente.

**Capas de la arquitectura:**

```
┌─────────────────────────────────────────────────────┐
│              UI LAYER (NO SE MODIFICA)              │
│  Components: ProductSearch, Cart, OrderCard, etc.  │
└─────────────────────────────────────────────────────┘
                        ↓ props/datos
┌─────────────────────────────────────────────────────┐
│           BUSINESS LOGIC LAYER (MODIFICAR)          │
│  • useProducts (buscar, filtrar, validar)          │
│  • useOrders (crear, listar, actualizar)           │
│  • useSync (sincronizar con Firestore)             │
│  • useCart (agregar, quitar, calcular)             │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│           SERVICES LAYER (CREAR NUEVO)              │
│  • productService (CRUD local)                      │
│  • syncService (delta sync con timestamps)         │
│  • cacheService (gestión de IndexedDB)             │
│  • conflictResolver (manejo de conflictos)         │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│              DATA LAYER (CREAR NUEVO)               │
│                                                     │
│  IndexedDB (Local)          Firestore (Remote)     │
│  ├─ products                ├─ products            │
│  ├─ catalogMetadata         ├─ metadata/catalog    │
│  ├─ pendingOrders           ├─ orders              │
│  ├─ syncQueue               └─ (nada más)          │
│  └─ orderHistory                                   │
└─────────────────────────────────────────────────────┘
```

### Storage Strategy

**IndexedDB (Cliente - Verdad local):**

Database name: `reina-chura-db`
Version: 1

**Stores (tablas):**

1. **products** (Catálogo completo local)
   - Key: `id` (string)
   - Índices: `name`, `productCode`, `updatedAt`
   - Contiene: Todos los productos con precios, stock, imágenes
   - Tamaño estimado: ~10MB para 1000 productos con imágenes

2. **catalogMetadata** (Metadatos de sincronización)
   - Key: `id` (fijo: "local")
   - Sin índices
   - Contiene:
     - `lastSynced`: timestamp de última sincronización exitosa
     - `totalProducts`: contador local
     - `syncStatus`: "synced" | "syncing" | "stale" | "error"

3. **pendingOrders** (Pedidos no sincronizados)
   - Key: `orderId` (string)
   - Índices: `createdAt`, `status`, `attempts`
   - Contiene: Pedidos completos con productos, cliente, totales
   - Se limpia automáticamente después de 7 días si ya sincronizados

4. **syncQueue** (Cola de tareas de sincronización)
   - Key: `taskId` (string)
   - Índices: `priority`, `status`, `nextRetryAt`
   - Contiene: Tareas pendientes (órdenes, actualizaciones de stock, etc)
   - Ordenadas por prioridad (1-10)

5. **orderHistory** (Historial local - opcional)
   - Key: `orderId` (string)
   - Índices: `createdAt`, `customerName`
   - Contiene: Copia local de pedidos para reportes offline
   - Opcional: Solo si se necesita acceso offline a historial

**localStorage (Mantener actual):**
- `cart-r-v1.1`: Carrito temporal (funciona bien)
- `customer-reina-v1.2`: Datos del cliente (funciona bien)

**Firestore (Servidor - Verdad remota):**

**Colecciones existentes (NO MODIFICAR estructura):**
- `products/`: Catálogo maestro
- `orders/`: Pedidos confirmados
- `orders/{orderId}/products`: Subcolección de productos por pedido

**Colecciones nuevas (AGREGAR):**
- `metadata/catalog`: UN SOLO documento con timestamp global

**Campos nuevos (AGREGAR a productos existentes):**
- `updatedAt`: Timestamp de última modificación del producto
- `salesStats`: Objeto con estadísticas de ventas (opcional para ranking)

---

## SISTEMA DE SINCRONIZACIÓN CON TIMESTAMPS

### Concepto Central

En vez de mantener un log histórico de cambios (costoso, crece infinitamente), usamos timestamps para identificar qué cambió.

**Dos timestamps clave:**

1. **Timestamp global** (`metadata/catalog.lastUpdated`):
   - Se actualiza CADA vez que CUALQUIER producto cambia
   - Permite verificar rápidamente si hay cambios (1 read ligero)

2. **Timestamp individual** (`products/{id}.updatedAt`):
   - Se actualiza cuando ESE producto específico cambia
   - Permite filtrar solo productos modificados

### Flujo de Sincronización

**PASO 1: Verificar si hay cambios**

Trigger: Cada 5 minutos, al abrir app, al recuperar conexión, manual

1. Leer `metadata/catalog` de Firestore (1 read)
2. Obtener `lastUpdated` del servidor
3. Comparar con `catalogMetadata.lastSynced` local
4. Si `remote.lastUpdated > local.lastSynced` → HAY CAMBIOS
5. Si son iguales → NO HAY NADA QUE HACER

**PASO 2: Decidir tipo de sincronización**

```
SI (no hay metadata local):
  → FULL SYNC (primera vez)

SI (diferencia de tiempo > 7 días):
  → FULL SYNC (muy desactualizado)

SI (diferencia de versión > 100 productos):
  → FULL SYNC (más eficiente que 100 deltas)

SINO:
  → DELTA SYNC (solo cambios)
```

**PASO 3A: Full Sync (descarga completa)**

Usado raramente (primera vez, o muy desactualizado)

1. Obtener TODOS los productos de Firestore
2. Usar paginación (500 productos por batch)
3. Guardar en IndexedDB con `bulkPut`
4. Actualizar `catalogMetadata.lastSynced` con timestamp actual
5. Notificar a UI: "Catálogo descargado completamente"

**PASO 3B: Delta Sync (solo cambios)**

Usado normalmente (99% de las veces)

1. Query a Firestore:
   - Colección: `products`
   - Filtro: `where('updatedAt', '>', localLastSynced)`
   - Orden: `orderBy('updatedAt', 'asc')`
   - Límite: 500 (por si acaso)

2. Procesar cada producto modificado:
   - Si existe en IndexedDB → UPDATE
   - Si no existe → INSERT (producto nuevo)
   - Si `isDeleted: true` en Firestore → DELETE de IndexedDB

3. Actualizar `catalogMetadata.lastSynced` con timestamp más reciente

4. Notificar a UI: "Catálogo actualizado (N cambios)"

**PASO 4: Actualizar timestamp global al modificar**

Cada vez que el admin/CEO modifica algo:

1. Usar `writeBatch()` de Firestore (atómico)
2. Actualizar el producto:
   - Campo modificado (ej: `price: 6000`)
   - Campo `updatedAt: serverTimestamp()`
3. Actualizar metadata global:
   - `metadata/catalog.lastUpdated: serverTimestamp()`
4. Commit batch (ambos se actualizan juntos)

**Ventajas de este sistema:**

1. **Simplicidad**: Solo 2 campos extra, cero colecciones adicionales
2. **Eficiencia**: 1 read para verificar + N reads solo de cambios
3. **Escalabilidad**: Funciona igual con 1000 o 100,000 productos
4. **Cero mantenimiento**: No hay logs que limpiar
5. **Nativo Firestore**: Usa índices automáticos, sin configuración especial

### Manejo de Productos Eliminados

Dos estrategias posibles:

**Opción A: Soft delete (recomendado)**
- Agregar campo `isDeleted: true` al producto
- No eliminar físicamente de Firestore
- Delta sync detecta `isDeleted: true` y elimina de IndexedDB
- Permite auditoría e histórico

**Opción B: Hard delete**
- Eliminar físicamente de Firestore
- Delta sync NO detecta eliminación (problema)
- Necesitamos full sync periódico para limpiar productos huérfanos
- O mantener una lista de IDs válidos en metadata

**Decisión: Usar Opción A (soft delete)**

### Sincronización Bidireccional

**Cliente → Servidor (Pedidos):**

Background worker detecta `pendingOrders` con `status: 'pending'`:

1. Crear orden en Firestore con batch:
   - Documento principal en `orders/`
   - Subcolección `orders/{orderId}/products`
   - Actualizar stock de cada producto
   - Actualizar `salesStats` (para ranking por popularidad)

2. Si éxito:
   - Marcar orden como `status: 'synced'` en IndexedDB
   - Mover a `orderHistory` (opcional)
   - Notificar al cliente vía página de estado

3. Si fallo (WiFi, stock insuficiente, etc):
   - Marcar como `status: 'failed'`
   - Programar reintento con exponential backoff
   - Después de 20 intentos → marcar como `permanent_failure`
   - Notificar al empleado y cliente

**Servidor → Cliente (Productos):**

Ya explicado arriba (delta sync con timestamps)

---

## FLUJOS DETALLADOS

### FLUJO 1: Búsqueda de Productos

**Actor:** Empleado
**Objetivo:** Encontrar producto en < 50ms

**Estado actual (LENTO):**
1. Empleado escribe "blusa rosa"
2. Debounce 500ms
3. 4 consultas a Firestore (name upper/lower, code upper/lower)
4. Combinar y deduplicar resultados
5. Renderizar en UI
**Tiempo total: 500-2000ms**

**Estado propuesto (RÁPIDO):**
1. Empleado escribe "blusa rosa"
2. Debounce 300ms (reducido)
3. Buscar en IndexedDB local:
   - Usar índice en `name` y `productCode`
   - Filtrar con coincidencia parcial
   - Ordenar por `salesStats.popularityScore` (descendente)
   - Limitar a 20 resultados
4. Renderizar en UI
**Tiempo total: < 50ms**

**Detalles técnicos:**

**Búsqueda local:**
- Usar Dexie.js con índice compuesto
- Búsqueda case-insensitive con `.startsWithIgnoreCase()`
- Soporte para múltiples campos simultáneos
- No hacer query a Firestore en absoluto

**Ranking por popularidad (opcional pero recomendado):**

Agregar a cada producto:
```
salesStats: {
  soldToday: 12,
  soldThisWeek: 47,
  totalSoldAllTime: 523,
  lastSoldAt: timestamp,
  popularityScore: calculado
}
```

Fórmula de popularidad:
```
score = (soldToday × 10) + (soldThisWeek × 3) + (totalSoldAllTime × 0.1)
```

Actualización de stats:
- Se actualiza cuando se confirma la orden en Firestore (background)
- No se actualiza en cliente (para evitar inconsistencias)

**Fallback:**
Si IndexedDB vacío (primera vez):
- Mostrar "Descargando catálogo..."
- Ejecutar full sync
- Después permitir búsquedas

---

### FLUJO 2: Crear Pedido (Optimista)

**Actor:** Empleado + Cliente
**Objetivo:** Cliente sale de la cola en < 5 segundos

**Estado actual (BLOQUEANTE):**
1. Empleado click "Finalizar pedido"
2. Validar stock en Firestore (10 reads)
3. Crear orden en Firestore (1 write)
4. Crear productos en subcolección (10 writes)
5. Actualizar stock (10 writes)
6. Generar PDF
7. Mostrar comprobante
8. Cliente se va
**Tiempo: 30-60 segundos (puede fallar en cualquier momento)**

**Estado propuesto (NO BLOQUEANTE):**
1. Empleado click "Finalizar pedido"
2. Validar stock LOCAL en IndexedDB (< 20ms)
3. Generar orderId único: `timestamp-random`
4. Guardar orden en `pendingOrders` de IndexedDB (< 30ms)
5. Actualizar stock local optimísticamente
6. Generar QR code (< 10ms)
7. Mostrar QR al cliente
8. Cliente escanea y SE VA de la cola
9. **Background worker sincroniza con Firestore (invisible)**
**Tiempo visible: < 100ms**

**Detalles críticos:**

**Validación local de stock:**

Al hacer click "Finalizar pedido":

1. Obtener productos del carrito
2. Para cada producto, verificar en IndexedDB:
   - Stock disponible físico
   - Menos stock reservado en pedidos pendientes
   - Si `stockReal - reserved < quantity` → ERROR inmediato

3. Si todo OK, continuar

**Generación de ID único:**

Formato: `{timestamp}-{random}`
Ejemplo: `1737900000000-k3j5h8p2`

Ventajas:
- No requiere consulta a Firestore
- Es único globalmente (timestamp + random)
- Ordenable por fecha (timestamp primero)
- Permite trackear orden antes de que esté en Firestore

**Guardado local (estructura):**

En `pendingOrders`:
```
{
  orderId: "1737900000000-k3j5h8p2",

  orderData: {
    customerName: "Juan Pérez",
    customerPhone: "+5491123456789",
    customerAddress: "Av. Mitre 123",
    total: 25000,
    createdAt: Timestamp(local),
    status: "pending"
  },

  products: [
    {
      product: { ...producto completo... },
      quantity: 3,
      selectedVariants: { size: "M", color: "Rosa" }
    },
    ...
  ],

  syncStatus: "pending",
  attempts: 0,
  lastAttemptAt: null,
  createdAt: Timestamp(local),

  optimisticStockUpdates: {
    "product-123": -3,  // Le quitamos 3 unidades localmente
    "product-456": -2
  }
}
```

**Actualización optimista de stock:**

Inmediatamente después de guardar el pedido:

1. Para cada producto en el pedido:
   - Leer de IndexedDB
   - Calcular: `newReserved = product.reserved + quantity`
   - Calcular: `newAvailable = product.available - quantity`
   - Actualizar en IndexedDB

2. Ahora otros empleados verán stock reducido inmediatamente
   (aunque el pedido aún no esté en Firestore)

**Generación de QR:**

URL: `https://tu-dominio.com/order-status/{orderId}`

El QR se genera en memoria (no requiere red)
Se muestra en modal al empleado
Empleado lo muestra al cliente (con pantalla o impreso)

**MUY IMPORTANTE (del documento):**
El empleado NECESITA tener localmente:
- Lista de productos del pedido (para buscar físicamente)
- Cantidades de cada producto
- Total a cobrar
- Datos del cliente

Por eso TODO se guarda en IndexedDB antes de mostrar QR.
El empleado puede consultar `pendingOrders` en cualquier momento.

---

### FLUJO 3: Background Sync Worker

**Actor:** Background process (invisible)
**Objetivo:** Sincronizar pedidos pendientes con Firestore

**Trigger:** Se ejecuta constantemente (loop cada 5 segundos)

**Algoritmo:**

1. Obtener tareas de `syncQueue` con:
   - `status: 'queued'` o `status: 'failed'`
   - Ordenadas por `priority` (descendente)
   - Filtrar: solo las que `nextRetryAt <= now`

2. Para cada tarea:
   a. Marcar como `status: 'processing'`

   b. Ejecutar sincronización (según tipo):
      - Si `type: 'order'` → sincronizar orden
      - Si `type: 'product'` → sincronizar producto modificado
      - Si `type: 'stock-check'` → actualizar stock desde Firestore

   c. Si ÉXITO:
      - Marcar tarea como `status: 'completed'`
      - Actualizar orden en IndexedDB: `syncStatus: 'synced'`
      - Notificar al cliente (actualizar página de estado)
      - Siguiente tarea

   d. Si FALLO:
      - Incrementar `attempts`
      - Calcular `nextRetryAt` con exponential backoff:
        - Intento 1: +2 segundos
        - Intento 2: +4 segundos
        - Intento 3: +8 segundos
        - Intento 4: +16 segundos
        - Intento 5: +32 segundos
        - Intento 6+: +60 segundos (máximo)
      - Marcar como `status: 'failed'`
      - Si `attempts >= 20` → permanent failure (ver abajo)
      - Guardar error en `lastError`

   e. Esperar 100ms antes de siguiente tarea (no saturar)

3. Dormir 5 segundos
4. Volver al paso 1 (loop infinito)

**Sincronización de orden:**

1. Obtener orden de `pendingOrders`
2. Crear batch de Firestore:
   - Crear documento en `orders/`
   - Crear documentos en `orders/{id}/products`
   - Actualizar stock de cada producto (decrementar)
   - Actualizar `salesStats` de cada producto
3. Ejecutar `batch.commit()`
4. Si éxito: marcar orden como synced
5. Si fallo: throw error (será atrapado por worker)

**Manejo de errores comunes:**

- `unavailable`: Firestore down o sin conexión
  - Reintentar con backoff

- `permission-denied`: Token expiró
  - Refrescar autenticación
  - Reintentar inmediatamente

- `not-found`: Documento referenciado no existe
  - Marcar como permanent failure
  - No reintentar

- `invalid-argument`: Datos mal formados
  - Marcar como permanent failure
  - Notificar al admin

- `resource-exhausted`: Límite de escrituras excedido
  - Esperar 60 segundos
  - Reintentar

**Permanent Failure:**

Después de 20 intentos fallidos (~ 20 minutos):

1. Marcar tarea como `status: 'permanent_failure'`
2. Liberar stock reservado localmente:
   - Para cada producto en la orden
   - Restaurar `reserved` y `available`
3. Notificar al empleado:
   - Toast/notificación: "Pedido {id} falló después de 20 intentos"
   - Botón: "Ver detalles" → muestra error
4. Notificar al cliente en página de estado:
   - "⚠️ No pudimos procesar tu pedido"
   - "Por favor regresa al mostrador"
   - Botón para llamar al negocio
5. Registrar en log para análisis:
   - Hora del fallo
   - Último error
   - Datos de la orden

---

### FLUJO 4: Página de Estado del Pedido (Cliente)

**Actor:** Cliente
**Objetivo:** Ver progreso de su pedido en tiempo real

**URL:** `https://tu-dominio.com/order-status/{orderId}`

**Estados posibles:**

1. **pending**: Pedido en cola para sincronización
   - Mostrar: "🔄 Procesando tu pedido..."
   - Spinner animado
   - Barra de progreso simulada (basada en tiempo)

2. **syncing**: Worker está sincronizando actualmente
   - Mostrar: "🔄 Guardando en el sistema..."
   - Barra de progreso simulada

3. **synced**: Orden guardada exitosamente en Firestore
   - Mostrar: "✅ ¡Pedido confirmado!"
   - Detalles: Total, productos, número de orden
   - Botón: "Descargar comprobante" (PDF)
   - Mensaje: "Dirígete a caja para pagar"

4. **failed**: Falló temporalmente, reintentando
   - Mostrar: "⚠️ Problema temporal"
   - Mensaje: "Reintentando automáticamente... (Intento X/20)"
   - Countdown hasta próximo reintento

5. **permanent_failure**: Falló después de 20 intentos
   - Mostrar: "🔴 Error al procesar tu pedido"
   - Mensaje: "Por favor regresa al mostrador. Tenemos tu pedido guardado."
   - Botón: "Llamar al negocio"
   - Botón: "Ver detalles del error" (para debugging)

**Actualización en tiempo real:**

Dos estrategias (implementar ambas con fallback):

**Estrategia A: Firestore Realtime Listener (si hay conexión)**

1. Suscribirse al documento `orders/{orderId}`
2. Cuando el documento aparece/cambia → actualizar UI
3. Ventaja: Actualización instantánea
4. Desventaja: Requiere conexión del cliente

**Estrategia B: Polling (fallback si sin conexión)**

1. Cada 3 segundos, intentar leer `orders/{orderId}`
2. Si existe → actualizar UI
3. Si no existe después de 5 minutos → mostrar warning
4. Ventaja: Funciona con conexión mala
5. Desventaja: Menos instantáneo

**Implementación híbrida:**
- Intentar Realtime Listener primero
- Si falla (offline) → fallback a Polling
- Mostrar indicador de conexión en la UI

---

### FLUJO 5: Manejo de Conflictos (Sobreventa)

**Escenario:** 2 empleados venden el mismo producto casi simultáneamente

**Ejemplo:**

```
Stock en Firestore: Blusa Rosa = 10 unidades

10:00:00 - Empleado A:
  - Carrito: 6 unidades de Blusa Rosa
  - Click "Finalizar pedido"
  - Validación local: OK (10 disponibles)
  - Guarda en pendingOrders
  - Actualiza stock local: reserved = 6, available = 4
  - Muestra QR al cliente A
  - Cliente A se va

10:00:05 - Empleado B:
  - Carrito: 5 unidades de Blusa Rosa
  - Click "Finalizar pedido"
  - Validación local: ¿available = 4 o 10?

CASO 1: Si B tiene catálogo DESACTUALIZADO (no sincronizó todavía)
  - available = 10 (ERROR - ve stock viejo)
  - Validación pasa incorrectamente
  - Guarda en pendingOrders
  - Actualiza stock local: reserved = 5, available = 5

CASO 2: Si B tiene catálogo ACTUALIZADO (sincronizó hace < 5 min)
  - available = 4 (CORRECTO - ve stock real)
  - Validación FALLA
  - Muestra error: "Stock insuficiente"
  - Empleado B debe buscar otro producto o reducir cantidad
```

**Prevención en cliente:**

1. **Sincronización frecuente de stock:**
   - Cada 30 segundos, actualizar stock de productos en carrito
   - Query: Solo los productos en el carrito actual
   - Actualizar en IndexedDB
   - Si stock cambió → notificar al empleado

2. **Validación considerando pedidos pendientes:**
   - Al calcular `available`:
   - `available = stock - reservedRemote - reservedLocal`
   - `reservedRemote`: Viene de Firestore (sincronizado)
   - `reservedLocal`: Suma de todos los `pendingOrders` locales

3. **Indicador visual:**
   - En búsqueda de productos, mostrar:
   - "Stock: 10 total"
   - "Reservado: 6 unidades (procesando)"
   - "Disponible: 4 unidades"

**Resolución en servidor:**

Cuando background worker intenta sincronizar:

1. **Empleado A (primer pedido):**
   - Stock en Firestore: 10
   - Pedido: 6 unidades
   - Batch update: `stock = 10 - 6 = 4`
   - Commit: ÉXITO ✅
   - Orden marcada como synced

2. **Empleado B (segundo pedido):**
   - Stock en Firestore: 4 (ya actualizado por A)
   - Pedido: 5 unidades
   - Batch update: `stock = 4 - 5 = -1` (NEGATIVO)
   - Validación en servidor: FALLA ❌
   - Batch abortado (no se commitea)
   - Error: "Stock insuficiente"

3. **Rollback automático para B:**
   - Marcar orden como `status: 'stock_insufficient'`
   - Liberar stock local:
     - `reserved -= 5`
     - `available += 5`
   - Notificar al empleado B:
     - "Pedido {id} falló: Stock insuficiente"
     - "Otro empleado vendió este producto primero"
   - Notificar al cliente B en página de estado:
     - "⚠️ Stock insuficiente"
     - "Por favor regresa al mostrador"

**Prevención adicional (recomendada):**

Implementar "soft lock" temporal:

1. Cuando empleado agrega producto al carrito:
   - Crear entrada en `product_locks` (Firestore)
   - Lock por 10 minutos
   - Contenido: `{ productId, employeeId, quantity, expiresAt }`

2. Al finalizar pedido o cancelar:
   - Eliminar lock

3. Al buscar productos:
   - Restar locks activos del stock disponible
   - Mostrar: "2 unidades reservadas temporalmente"

4. Cleanup automático:
   - Cloud Function cada 5 minutos
   - Eliminar locks expirados

Ventaja: Previene conflictos antes de que ocurran
Desventaja: Más complejo, requiere Cloud Functions

**Decisión: Implementar validación en servidor (simple), considerar locks después si es necesario**

---

## PLAN DE IMPLEMENTACIÓN POR FASES

### FASE 0: Preparación (1 día)

**Objetivo:** Setup de herramientas y dependencias

**Tareas:**

1. **Instalar Dexie.js:**
   - Versión recomendada: 4.x (más reciente)
   - Permite TypeScript (opcional)
   - Docs: dexie.org

2. **Crear estructura de carpetas:**
   ```
   /src/src/
   ├── /services/
   │   ├── cacheService.js
   │   ├── syncService.js
   │   ├── productService.js
   │   └── orderService.js
   ├── /hooks/
   │   ├── useProducts.jsx (nuevo)
   │   ├── useSync.jsx (nuevo)
   │   └── useLocalOrders.jsx (nuevo)
   └── /db/
       └── indexedDB.js (configuración Dexie)
   ```

3. **Backup de código actual:**
   - Git branch: `backup-before-offline-first`
   - Commit: "Estado antes de implementar arquitectura offline-first"

4. **Configurar testing environment:**
   - Chrome DevTools → Network throttling
   - Crear profiles: "3G Slow", "Offline", "Intermittent"

**Criterio de éxito:**
- Dexie instalado y funcional (test básico)
- Carpetas creadas
- Backup realizado
- Testing environment configurado

---

### FASE 1: IndexedDB + Migración de Timestamps (2-3 días)

**Objetivo:** Crear storage local y preparar Firestore para delta sync

**Tareas:**

**1.1: Configurar IndexedDB con Dexie**

Crear archivo `/src/src/db/indexedDB.js`:

- Definir database: `reina-chura-db`
- Definir version: 1
- Definir stores:
  - products (key: id, índices: name, productCode, updatedAt)
  - catalogMetadata (key: id)
  - pendingOrders (key: orderId, índices: createdAt, status)
  - syncQueue (key: taskId, índices: priority, status, nextRetryAt)
- Exportar instancia de DB
- Agregar manejo de errores (QuotaExceededError)

**1.2: Crear servicio de caché**

Crear `/src/src/services/cacheService.js`:

- `initDB()`: Inicializar IndexedDB
- `saveProducts(products)`: Guardar array de productos
- `getProduct(id)`: Obtener producto por ID
- `getAllProducts()`: Obtener todos los productos
- `searchProducts(term)`: Buscar por nombre o código
- `updateProduct(id, data)`: Actualizar producto
- `deleteProduct(id)`: Eliminar producto
- `clearProducts()`: Limpiar catálogo (para full sync)
- `getMetadata()`: Obtener metadata de sincronización
- `updateMetadata(data)`: Actualizar metadata

**1.3: Migración de Firestore (agregar timestamps)**

Script de migración una vez (puede ser Cloud Function o script local):

1. Leer TODOS los productos de Firestore
2. Para cada producto:
   - Si no tiene `updatedAt`:
     - Agregar `updatedAt: serverTimestamp()`
     - Update en Firestore
3. Crear documento `metadata/catalog`:
   - `lastUpdated: serverTimestamp()`
   - `totalProducts: contador`
4. Ejecutar en batches de 500 (límite de Firestore)

**1.4: Modificar admin panel para actualizar timestamps**

En componentes que modifican productos (EditProduct, ProductFormModal, etc):

1. Cambiar `updateDoc()` por `writeBatch()`
2. Agregar al batch:
   - Actualización del producto con `updatedAt: serverTimestamp()`
   - Actualización de `metadata/catalog` con `lastUpdated: serverTimestamp()`
3. Commit batch

**1.5: Testing de IndexedDB**

Tests manuales:
- Guardar 10 productos en IndexedDB
- Leer productos
- Buscar por nombre
- Buscar por código
- Actualizar producto
- Verificar que IndexedDB persiste después de reload
- Verificar límite de storage (intentar guardar 100MB)

**Criterio de éxito:**
- IndexedDB funcional con Dexie
- cacheService completo y testeado
- Todos los productos en Firestore tienen `updatedAt`
- metadata/catalog existe con `lastUpdated`
- Admin panel actualiza timestamps correctamente

---

### FASE 2: Sistema de Sincronización (3-4 días)

**Objetivo:** Implementar full sync y delta sync

**Tareas:**

**2.1: Crear syncService**

Crear `/src/src/services/syncService.js`:

**Funciones principales:**

- `checkForUpdates()`: Comparar timestamps, decidir qué hacer
- `fullSync()`: Descargar catálogo completo
- `deltaSync(lastTimestamp)`: Descargar solo cambios
- `syncOrder(orderId)`: Sincronizar orden pendiente
- `getSyncStatus()`: Estado actual de sincronización

**Algoritmo de checkForUpdates():**

1. Verificar si hay conexión (navigator.onLine)
2. Obtener metadata remota (Firestore)
3. Obtener metadata local (IndexedDB)
4. Comparar timestamps
5. Decidir full sync vs delta sync
6. Ejecutar sincronización correspondiente
7. Actualizar metadata local
8. Emitir evento "sync-completed"

**Algoritmo de fullSync():**

1. Obtener total de productos en Firestore
2. Calcular número de páginas (500 productos por página)
3. Para cada página:
   - Query con `limit(500)` y `startAfter(lastDoc)`
   - Guardar en IndexedDB con `bulkPut()`
   - Actualizar progreso
4. Actualizar metadata local
5. Retornar estadísticas (total descargados, tiempo)

**Algoritmo de deltaSync():**

1. Query a Firestore:
   - `where('updatedAt', '>', lastTimestamp)`
   - `orderBy('updatedAt', 'asc')`
   - `limit(500)`
2. Para cada producto:
   - Si `isDeleted: true` → delete de IndexedDB
   - Sino → upsert en IndexedDB
3. Si hay > 500 resultados → paginar
4. Actualizar metadata local con timestamp más reciente
5. Retornar estadísticas

**Algoritmo de syncOrder():**

1. Obtener orden de `pendingOrders`
2. Validar stock en Firestore (double-check)
3. Crear batch:
   - Crear orden en `orders/`
   - Crear productos en `orders/{id}/products`
   - Decrementar stock de cada producto
   - Actualizar `salesStats` (opcional)
4. Commit batch (atómico)
5. Actualizar orden local: `syncStatus: 'synced'`
6. Retornar resultado

**2.2: Crear hook useSync**

Crear `/src/src/hooks/useSync.jsx`:

Custom hook que expone:
- `syncStatus`: "idle" | "syncing" | "synced" | "error"
- `lastSynced`: timestamp de última sincronización
- `pendingChanges`: número de cambios pendientes
- `triggerSync()`: función para forzar sincronización manual
- `syncProgress`: { current, total } para barra de progreso

**2.3: Implementar SyncScheduler**

Crear `/src/src/services/syncScheduler.js`:

Clase que maneja triggers automáticos:

- Constructor: recibe syncService como dependencia
- `start()`: Iniciar scheduler
- `stop()`: Detener scheduler

**Triggers:**

1. **Al cargar app:** sync inmediato
2. **Cada 5 minutos:** sync si está online
3. **Event 'online':** sync cuando vuelve conexión
4. **Event 'visibilitychange':** sync al enfocar tab (si > 2 min)
5. **Manual:** cuando usuario presiona botón

**2.4: Background Sync Worker**

Crear `/src/src/services/backgroundWorker.js`:

Proceso que corre en loop infinito:

1. Cada 5 segundos, revisar `syncQueue`
2. Obtener tareas pendientes (ordenadas por prioridad)
3. Para cada tarea:
   - Si `nextRetryAt > now` → skip
   - Sino → ejecutar
   - Actualizar status según resultado
4. Dormir 5 segundos
5. Repetir

**Manejo de reintentos:**

- Incrementar `attempts`
- Calcular `nextRetryAt` con exponential backoff
- Después de 20 intentos → permanent failure
- Liberar stock y notificar

**2.5: Testing de sincronización**

Tests manuales:

**Test 1: Full sync inicial**
- Vaciar IndexedDB
- Llamar `checkForUpdates()`
- Verificar que descarga todos los productos
- Verificar metadata actualizada

**Test 2: Delta sync**
- Modificar 3 productos en Firestore (cambiar precio)
- Esperar 10 segundos
- Llamar `checkForUpdates()`
- Verificar que solo descarga esos 3 productos

**Test 3: Sync con WiFi lento**
- Network throttling: "3G Slow"
- Llamar `checkForUpdates()`
- Verificar que termina (aunque tarde)

**Test 4: Sync offline**
- Network throttling: "Offline"
- Llamar `checkForUpdates()`
- Verificar que falla gracefully
- Verificar que retoma al volver online

**Criterio de éxito:**
- syncService completo y testeado
- checkForUpdates detecta cambios correctamente
- fullSync descarga todos los productos
- deltaSync descarga solo cambios
- SyncScheduler ejecuta triggers correctamente
- Funciona con WiFi lento y offline

---

### FASE 3: Búsqueda Local (2 días)

**Objetivo:** Búsqueda ultra-rápida desde IndexedDB

**Tareas:**

**3.1: Crear hook useProducts**

Crear `/src/src/hooks/useProducts.jsx`:

Hook que reemplaza `useFirestore` para productos:

- `products`: array de productos (desde IndexedDB)
- `searchProducts(term)`: buscar por nombre o código
- `getProduct(id)`: obtener producto por ID
- `isLoading`: boolean
- `error`: objeto de error

**Implementación de searchProducts():**

1. Recibir `term` del usuario
2. Limpiar y normalizar: lowercase, trim
3. Buscar en IndexedDB:
   - Índice `name` con `.startsWithIgnoreCase()`
   - Índice `productCode` con `.startsWithIgnoreCase()`
   - Combinar resultados
   - Deduplicar por ID
4. Ordenar por `salesStats.popularityScore` (descendente)
5. Limitar a 20 resultados
6. Retornar en < 50ms

**3.2: Modificar ProductSearch component**

NO cambiar UI, solo lógica interna:

Antes:
- Usaba `searchProductsByNameOrCode()` de useFirestore
- Hacía 4 queries a Firestore

Después:
- Usa `searchProducts()` de useProducts
- Busca en IndexedDB local
- Mismo output (array de productos)

**Cambios mínimos:**
- Importar `useProducts` en vez de `useFirestore`
- Cambiar `searchProductsByNameOrCode(term)` por `searchProducts(term)`
- Todo lo demás IGUAL (misma UI, mismos props)

**3.3: Implementar ranking por popularidad (opcional)**

Si hay tiempo:

1. Agregar campo `salesStats` a productos
2. Calcular `popularityScore` al confirmar orden
3. Ordenar resultados de búsqueda por score
4. Agregar badge visual "🔥 Popular" en productos top

**3.4: Testing de búsqueda**

Tests manuales:

**Test 1: Búsqueda básica**
- Buscar "blusa"
- Verificar que retorna resultados
- Medir tiempo (debe ser < 50ms)

**Test 2: Búsqueda por código**
- Buscar "#045"
- Verificar que encuentra por productCode

**Test 3: Búsqueda offline**
- Network throttling: "Offline"
- Buscar "pantalon"
- Verificar que funciona sin conexión

**Test 4: Búsqueda con catálogo vacío**
- Vaciar IndexedDB
- Buscar algo
- Verificar que muestra "Descargando catálogo..."
- Después de full sync, búsqueda funciona

**Test 5: Performance**
- Buscar término que retorna 50 resultados
- Medir tiempo de respuesta
- Debe ser < 50ms consistentemente

**Criterio de éxito:**
- useProducts hook funcional
- ProductSearch usa IndexedDB (no Firestore)
- Búsqueda < 50ms consistentemente
- Funciona offline
- UI visualmente IGUAL (cero cambios visuales)

---

### FASE 4: Pedidos Optimistas (3-4 días)

**Objetivo:** Crear pedidos instantáneamente, sincronizar después

**Tareas:**

**4.1: Modificar OrderContext**

Agregar funciones:

- `createLocalOrder(orderData, products)`: Crea orden en IndexedDB
- `getLocalOrder(orderId)`: Obtiene orden de IndexedDB
- `getPendingOrders()`: Lista pedidos no sincronizados
- `clearPendingOrder(orderId)`: Elimina después de sync

**4.2: Crear hook useLocalOrders**

Crear `/src/src/hooks/useLocalOrders.jsx`:

- `createOrder(orderData, products)`: Crea orden localmente
- `getPendingOrders()`: Lista pedidos pendientes
- `getOrderById(orderId)`: Obtiene orden (local o Firestore)
- `syncOrder(orderId)`: Fuerza sincronización de orden específica

**Implementación de createOrder():**

1. Validar stock local (considerando pedidos pendientes)
2. Generar orderId único: `Date.now()-Math.random().toString(36)`
3. Crear objeto de orden completa
4. Guardar en `pendingOrders` de IndexedDB
5. Actualizar stock local optimísticamente (reserved, available)
6. Agregar tarea a `syncQueue` con prioridad alta
7. Retornar `{ orderId, success: true }`

**4.3: Modificar Cart component**

En función `handleSubmit()` (al hacer click "Finalizar pedido"):

Antes:
- Llamaba `createOrderWithProducts()` de useFirestore (bloqueante)
- Esperaba respuesta de Firestore
- Mostraba loading spinner
- Navegaba a Orders después de éxito

Después:
- Llamar `createOrder()` de useLocalOrders (no bloqueante)
- Guardar `orderId` retornado
- Mostrar QR modal inmediatamente (< 100ms)
- Background worker sincroniza automáticamente

**4.4: Crear componente QRModal**

Ya existe en `/src/src/modals/Qrmodal/index.jsx` → REUTILIZAR

Modificar para:
- Recibir `orderId` como prop
- Generar QR con URL: `${baseURL}/order-status/${orderId}`
- Mostrar mensaje: "Muestra este QR al cliente"
- Botón: "Imprimir QR" (opcional)
- Botón: "Cerrar" → permite atender siguiente cliente

**4.5: Crear página OrderStatus**

Nueva ruta: `/order-status/:orderId`

Componente: `/src/src/pages/OrderStatus/index.jsx`

**Estados a mostrar:**

1. `pending`: "🔄 Procesando tu pedido..."
2. `syncing`: "🔄 Guardando en el sistema..."
3. `synced`: "✅ ¡Pedido confirmado!" + detalles
4. `failed`: "⚠️ Reintentando... (X/20)"
5. `permanent_failure`: "🔴 Error - Regresa al mostrador"

**Lógica:**

1. Obtener `orderId` de URL params
2. Intentar suscribirse a `orders/{orderId}` en Firestore (realtime)
3. Si documento existe → mostrar estado "synced"
4. Si no existe → mostrar estado "pending" y polling cada 3 segundos
5. Si después de 5 minutos no aparece → warning

**4.6: Modificar Background Worker para procesar órdenes**

Agregar lógica para tareas tipo "order":

1. Obtener orden de `pendingOrders`
2. Llamar `syncService.syncOrder(orderId)`
3. Si éxito:
   - Marcar orden como synced
   - Remover de `pendingOrders` (o marcar como synced)
4. Si fallo:
   - Incrementar attempts
   - Calcular nextRetryAt
   - Si attempts >= 20 → permanent failure

**4.7: Testing de pedidos optimistas**

Tests manuales:

**Test 1: Crear pedido online**
- Agregar productos al carrito
- Click "Finalizar pedido"
- Verificar que QR aparece en < 1 segundo
- Escanear QR con celular
- Verificar que página muestra "Procesando..."
- Esperar 5 segundos
- Verificar que cambia a "Confirmado"
- Verificar que pedido aparece en Firestore

**Test 2: Crear pedido offline**
- Network throttling: "Offline"
- Agregar productos al carrito
- Click "Finalizar pedido"
- Verificar que QR aparece inmediatamente (funciona sin red)
- Escanear QR
- Verificar que página muestra "Procesando..."
- Habilitar conexión
- Esperar 10 segundos
- Verificar que sincroniza y cambia a "Confirmado"

**Test 3: Conflicto de stock**
- 2 dispositivos/pestañas como empleados diferentes
- Producto X con stock = 5
- Empleado A: vende 3 unidades → OK
- Empleado B: vende 3 unidades → ¿cómo se comporta?
- Verificar que uno falla y muestra error de stock

**Test 4: Pedido que falla permanentemente**
- Crear pedido con producto que no existe en Firestore
- Verificar que reintenta 20 veces
- Verificar que después muestra permanent failure
- Verificar que libera stock local

**Criterio de éxito:**
- Crear pedido toma < 100ms
- QR aparece inmediatamente
- Cliente puede escanear y salir de la cola
- Background sincroniza correctamente
- Página de estado funciona
- Maneja fallos con reintentos
- Funciona offline (pedido se guarda y sincroniza después)

---

### FASE 5: Manejo de Conflictos (2 días)

**Objetivo:** Prevenir sobreventa con validación local mejorada

**Tareas:**

**5.1: Mejorar validación de stock local**

En `createOrder()`:

Antes de crear pedido:

1. Para cada producto en el carrito:
   - Obtener producto de IndexedDB
   - Calcular `reserved` sumando todos los `pendingOrders` que lo incluyen
   - Calcular `available = stock - reserved`
   - Si `quantity > available` → ERROR

2. Si algún producto falla validación:
   - Mostrar modal con detalles:
     - "Stock insuficiente para {producto}"
     - "Disponible: {available} unidades"
     - "Solicitado: {quantity} unidades"
     - "Razón: {reserved} unidades reservadas en pedidos procesando"
   - No crear pedido
   - Permitir al empleado ajustar cantidades

**5.2: Sincronización de stock en tiempo real**

Crear función `syncCartStock()`:

- Se ejecuta cada 30 segundos mientras el carrito está abierto
- Obtiene solo los productos que están en el carrito actual
- Actualiza su stock desde Firestore
- Si detecta cambio significativo → notificar al empleado

**5.3: Indicadores visuales de stock**

Modificar componente que muestra productos en búsqueda:

Agregar badges:
- "Stock: {total} unidades"
- "Reservado: {reserved} unidades (procesando)" (si reserved > 0)
- "Disponible: {available} unidades"

Color coding:
- Verde: available > 10
- Amarillo: available 5-10
- Rojo: available < 5
- Gris: available = 0

**5.4: Resolver conflictos en servidor**

En `syncService.syncOrder()`:

Al crear batch de Firestore:

1. Usar transacciones si es posible (más seguro)
2. Validar stock ANTES de commit:
   - Para cada producto, leer stock actual
   - Si alguno es insuficiente → abortar batch
   - Retornar error específico: "STOCK_INSUFFICIENT"

3. Manejar error en background worker:
   - Si error = "STOCK_INSUFFICIENT":
     - Marcar orden como `stock_insufficient`
     - Liberar stock local
     - Notificar empleado y cliente
     - NO reintentar (no tiene sentido)

**5.5: Testing de conflictos**

Tests manuales:

**Test 1: Validación local previene conflicto**
- Producto con stock = 5
- Empleado A: agrega 3 al carrito, finaliza pedido (OK)
- Empleado B: agrega 3 al carrito, intenta finalizar
- Verificar que B ve error ANTES de crear pedido local

**Test 2: Conflicto resuelto en servidor**
- Producto con stock = 5
- Empleado A y B offline
- Ambos agregan 3 al carrito y finalizan (ambos OK localmente)
- Vuelven online
- Background workers intentan sincronizar
- Verificar que uno éxito, otro falla
- Verificar que el que falla libera stock y notifica

**Test 3: Stock se actualiza en tiempo real**
- Empleado A: tiene producto X en carrito (stock = 10)
- Empleado B: vende 8 unidades de X
- Esperar 30 segundos (syncCartStock)
- Empleado A: ver si su carrito muestra stock actualizado (2 disponibles)

**Criterio de éxito:**
- Validación local previene la mayoría de conflictos
- Servidor resuelve conflictos que ocurren
- Stock se actualiza en tiempo real en carritos abiertos
- Indicadores visuales claros de disponibilidad
- Empleado recibe feedback claro cuando hay conflicto

---

### FASE 6: UI/UX Polish (1-2 días)

**Objetivo:** Feedback visual para el usuario

**Tareas:**

**6.1: Componente SyncStatusIndicator**

Crear `/src/src/components/SyncStatusIndicator/index.jsx`:

Muestra en navbar o footer:

Estados:
- ✅ "Catálogo actualizado (hace 2 min)"
- 🔄 "Actualizando catálogo... (45%)"
- ⚠️ "Catálogo desactualizado - [Actualizar ahora]"
- 🔴 "Sin conexión - Modo offline"
- 🔄 "3 pedidos esperando sincronizar"

Usar `useSync` hook para obtener datos

**6.2: Toast notifications**

Instalar librería de toasts (react-hot-toast o sonner)

Notificaciones:
- "Catálogo actualizado (N cambios)"
- "Pedido creado localmente"
- "Pedido sincronizado con éxito"
- "Stock insuficiente para {producto}"
- "Error al sincronizar, reintentando..."

**6.3: Loading states**

Agregar skeletons:
- En búsqueda mientras carga IndexedDB
- En página de órdenes mientras carga
- En página de estado mientras verifica Firestore

**6.4: Offline indicator**

Banner en top de página cuando está offline:
- "⚠️ Sin conexión - Trabajando en modo offline"
- "Tus pedidos se guardarán cuando vuelva la conexión"
- Fondo amarillo/naranja
- Se oculta automáticamente cuando vuelve conexión

**6.5: Admin dashboard para pedidos atascados**

Nueva página: `/admin/pending-orders`

Muestra:
- Lista de pedidos en `pendingOrders` con status != 'synced'
- Para cada uno:
  - OrderId, cliente, total, tiempo creado
  - Status: pending / syncing / failed
  - Número de intentos
  - Último error
  - Botón: "Forzar reintento"
  - Botón: "Marcar como fallido"
  - Botón: "Ver detalles"

**Criterio de éxito:**
- SyncStatusIndicator siempre visible y actualizado
- Toasts informativos en momentos clave
- Loading states consistentes
- Offline indicator funcional
- Admin puede ver y gestionar pedidos atascados

---

### FASE 7: Testing Exhaustivo (2-3 días)

**Objetivo:** Probar todos los casos edge

**Tareas:**

**7.1: Tests de conectividad**

**Test 1: Offline completo**
- Desconectar WiFi completamente
- Abrir aplicación
- Verificar que catálogo carga desde IndexedDB
- Buscar productos
- Agregar al carrito
- Crear pedido
- Verificar que QR funciona
- Reconectar WiFi
- Verificar que pedido se sincroniza automáticamente

**Test 2: Conexión intermitente**
- Network throttling: Custom
- Simular: 5 seg online, 3 seg offline, repetir
- Crear múltiples pedidos
- Verificar que eventualmente se sincronizan todos

**Test 3: Conexión lenta (3G)**
- Network throttling: "3G Slow"
- Buscar productos (debe seguir siendo rápido)
- Crear pedido (debe seguir siendo instantáneo)
- Sincronización tarda más pero funciona

**7.2: Tests de concurrencia**

**Test 1: 2 empleados simultáneos**
- 2 pestañas/dispositivos
- Ambos buscan, agregan al carrito, crean pedidos
- Verificar que ambos funcionan sin bloquearse
- Verificar que stock se actualiza correctamente

**Test 2: 5 empleados simultáneos**
- 5 pestañas/dispositivos
- Todos crean pedidos al mismo tiempo
- Verificar que todos se crean localmente
- Verificar que todos se sincronizan (background worker los procesa uno por uno)

**Test 3: Race condition de stock**
- 2 empleados
- Producto con stock = 1
- Ambos intentan vender 1 unidad simultáneamente
- Verificar que uno éxito, otro falla
- Verificar que el que falla recibe feedback claro

**7.3: Tests de edge cases**

**Test 1: IndexedDB lleno**
- Llenar storage del navegador (agregar datos basura)
- Intentar full sync
- Verificar que maneja QuotaExceededError gracefully
- Mostrar mensaje al usuario: "Espacio insuficiente, libera espacio"

**Test 2: Producto eliminado mientras está en carrito**
- Empleado A: agrega producto X al carrito
- Admin: elimina producto X de Firestore
- Background: delta sync detecta eliminación
- Empleado A: intenta finalizar pedido
- Verificar que recibe error: "Producto ya no disponible"

**Test 3: CEO cambia precio mientras pedido en progreso**
- Empleado: agrega producto (precio $5000) al carrito
- CEO: cambia precio a $6000
- Empleado: finaliza pedido
- Verificar que se guarda con precio ORIGINAL ($5000)
- Motivo: el snapshot del producto se guarda en pendingOrders

**Test 4: Cliente nunca escanea QR**
- Crear pedido, mostrar QR
- Cliente no escanea, se va
- Pedido igual se sincroniza
- Verificar que queda en Firestore (sin problema)

**Test 5: Cliente escanea QR después de 1 hora**
- Crear pedido, obtener QR
- Esperar 1 hora (o simular)
- Escanear QR
- Verificar que página de estado muestra info correcta (ya sincronizado)

**Test 6: Navegador se cierra mientras sincroniza**
- Crear pedido
- Cerrar navegador/tab inmediatamente
- Reabrir aplicación
- Verificar que pedido sigue en `pendingOrders`
- Verificar que background worker lo retoma

**7.4: Tests de performance**

**Test 1: Búsqueda con 1000 productos**
- Llenar IndexedDB con 1000 productos
- Buscar término que retorna 50 resultados
- Medir tiempo de respuesta
- Debe ser < 50ms

**Test 2: Full sync de 1000 productos**
- Vaciar IndexedDB
- Ejecutar full sync
- Medir tiempo total
- Debe completarse en < 30 segundos (con conexión normal)

**Test 3: Crear 10 pedidos seguidos**
- Crear 10 pedidos rápidamente (uno tras otro)
- Medir tiempo por pedido
- Cada uno debe tomar < 200ms
- Todos deben sincronizarse eventualmente

**Test 4: Abrir app con 50 pedidos pendientes**
- Simular 50 pedidos en `pendingOrders` (con script)
- Abrir aplicación
- Background worker debe procesarlos todos
- Verificar que no se traba
- Verificar que procesa con prioridad (más antiguos primero)

**7.5: Tests de UI**

**Test 1: Verificar que UI no cambió visualmente**
- Comparar screenshots antes/después
- Verificar que todos los componentes se ven igual
- Verificar que no hay regresiones visuales

**Test 2: Verificar feedback al usuario**
- Crear pedido → ver toast de confirmación
- Sincronización exitosa → ver toast
- Error de stock → ver modal con detalles
- Sin conexión → ver banner offline

**Test 3: Verificar estados de loading**
- Primera carga de app → ver loading de catálogo
- Búsqueda en proceso → ver loading state
- Orden sincronizando → ver spinner en página de estado

**Criterio de éxito:**
- Todos los tests pasan
- No hay bugs bloqueantes
- Performance cumple métricas (< 50ms búsqueda, < 100ms crear pedido)
- UI igual o mejor que antes
- Feedback claro al usuario en todos los casos

---

### FASE 8: Deployment & Monitoring (1 día)

**Objetivo:** Lanzar a producción y monitorear

**Tareas:**

**8.1: Preparar para producción**

1. **Remover console.logs:**
   - Buscar todos los `console.log()` de debug
   - Reemplazar por logger centralizado (solo en dev)

2. **Configurar variables de entorno:**
   - `VITE_ENABLE_DEBUG_LOGS`: false en producción
   - `VITE_SYNC_INTERVAL`: 300000 (5 minutos)
   - `VITE_MAX_RETRY_ATTEMPTS`: 20

3. **Build de producción:**
   - `npm run build`
   - Verificar que no hay warnings críticos
   - Verificar tamaño del bundle (no debe crecer mucho)

**8.2: Migración de datos**

1. **Script de migración para usuarios existentes:**
   - Al abrir app, detectar si es primera vez con nueva versión
   - Ejecutar full sync automáticamente
   - Mostrar mensaje: "Actualizando sistema... (solo primera vez)"
   - Migrar pedidos de localStorage a IndexedDB si es necesario

**8.3: Deploy gradual**

**Fase 1: Beta testing (1-2 empleados)**
- Desplegar a 2 empleados seleccionados
- Monitorear durante 1 día
- Recoger feedback
- Fix bugs críticos

**Fase 2: Rollout parcial (50% empleados)**
- Si beta OK, desplegar a mitad de los empleados
- Monitorear durante 2 días
- Comparar métricas vs grupo control

**Fase 3: Rollout completo (100%)**
- Si todo OK, desplegar a todos
- Monitorear durante 1 semana

**8.4: Monitoreo**

**Métricas a trackear:**

1. **Performance:**
   - Tiempo promedio de búsqueda
   - Tiempo promedio de creación de pedido
   - Tiempo promedio de sincronización

2. **Reliability:**
   - % de pedidos sincronizados exitosamente
   - % de pedidos que fallan permanentemente
   - Tiempo promedio hasta sincronización

3. **Usage:**
   - Número de búsquedas por día
   - Número de pedidos por día
   - Número de empleados activos

4. **Errors:**
   - Errores de QuotaExceeded (IndexedDB lleno)
   - Errores de stock insuficiente
   - Errores de red
   - Errores inesperados

**Herramientas:**

- Google Analytics o Mixpanel para eventos
- Sentry o similar para error tracking
- Custom dashboard con Firebase Analytics

**8.5: Documentación**

Crear docs para:

1. **Empleados:**
   - Guía: ¿Qué hacer si se muestra "Sin conexión"?
   - Guía: ¿Qué hacer si pedido falla?
   - Guía: ¿Cómo forzar actualización de catálogo?

2. **Admin:**
   - Guía: Cómo ver pedidos atascados
   - Guía: Cómo forzar reintento de pedido
   - Guía: Cómo modificar productos (importante: actualizar timestamps)

3. **Developers:**
   - Arquitectura técnica
   - Flujos de datos
   - Cómo extender el sistema
   - Troubleshooting común

**Criterio de éxito:**
- Deploy exitoso sin downtime
- Todos los empleados pueden usar el sistema
- Monitoreo funcionando
- No hay regresiones críticas
- Documentación completa

---

## CASOS EDGE Y MANEJO DE CONFLICTOS

### Caso 1: IndexedDB Corrupto

**Escenario:**
IndexedDB del navegador se corrompe (poco común pero puede pasar)

**Detección:**
- Error al intentar abrir DB
- Error al leer/escribir datos
- Datos inconsistentes

**Solución:**

1. Catch error al inicializar IndexedDB
2. Mostrar mensaje: "Detectamos un problema con los datos locales"
3. Botón: "Reparar" → ejecuta:
   - Borrar IndexedDB completamente
   - Recrear estructura
   - Ejecutar full sync
4. Notificar al admin sobre la corrupción (para estadísticas)

### Caso 2: Timestamp Desincronizado

**Escenario:**
Reloj del servidor y cliente muy diferentes

**Problema:**
- Cliente timestamp: 2026-01-26 10:00:00
- Servidor timestamp: 2026-01-26 09:50:00 (10 min atrás)
- Cliente cree que está actualizado, pero no lo está

**Solución:**

1. NO usar timestamps locales del cliente
2. Siempre usar `serverTimestamp()` de Firestore
3. Al comparar, usar timestamps del servidor únicamente
4. Si se detecta diferencia > 1 hora → warning al admin

### Caso 3: Catálogo Muy Desactualizado

**Escenario:**
Empleado no abre app por 1 mes

**Problema:**
- Último sync: hace 30 días
- 500+ cambios acumulados
- Delta sync sería ineficiente

**Solución:**

1. Al detectar `localLastSynced < (now - 7 days)`:
   - Forzar full sync
   - Mostrar mensaje: "Descargando catálogo actualizado..."
2. No intentar delta sync (sería lento y costoso)

### Caso 4: Producto con Stock Negativo

**Escenario:**
Por bug o edición manual, stock en Firestore = -5

**Problema:**
- Empleados verían stock "disponible"
- Podrían vender producto que no existe

**Solución:**

1. Al descargar productos en delta/full sync:
   - Validar: `if (product.stock < 0) product.stock = 0`
   - Log warning para admin
2. En búsqueda, mostrar "Sin stock" si `available <= 0`
3. Validación adicional al crear pedido
4. Dashboard de admin muestra productos con stock negativo (para corrección manual)

### Caso 5: Orden Duplicada

**Escenario:**
- Background worker sincroniza orden
- WiFi se cae justo después de commit pero antes de actualizar estado local
- Worker reintenta y vuelve a sincronizar la misma orden

**Problema:**
- 2 órdenes idénticas en Firestore
- Stock descontado 2 veces

**Solución:**

1. Usar `orderId` generado en cliente (único)
2. Al sincronizar, usar `setDoc()` con `orderId` específico (no autogenerado)
3. Si ya existe → Firestore retorna éxito sin duplicar
4. Idempotencia garantizada

### Caso 6: Cliente Cierra Página de Estado Antes de Sincronizar

**Escenario:**
- Cliente escanea QR
- Ve "Procesando..."
- Cierra navegador por impaciencia
- Pedido igual se sincroniza

**Problema:**
- Cliente no ve confirmación
- No sabe si su pedido fue exitoso

**Solución:**

1. Agregar en página de estado:
   - Mensaje: "Puedes cerrar esta página, te avisaremos por WhatsApp"
   - (Opcional) Integración con WhatsApp Business API
2. Permitir que cliente vuelva a escanear QR después
3. Si orden ya sincronizada → mostrar detalles
4. Si todavía pendiente → mostrar "Procesando..."

### Caso 7: Empleado Modifica Producto Localmente (Precio, etc)

**Escenario:**
- Empleado A tiene catálogo cacheado
- CEO cambia precio en Firestore
- Empleado A crea pedido con precio viejo

**Problema:**
- Cliente paga precio incorrecto

**Solución:**

1. NO permitir modificación local de productos (read-only)
2. Solo el admin panel puede modificar (directo a Firestore)
3. Pedidos guardan snapshot completo del producto (precio, nombre, etc)
4. Al crear pedido, el precio es el que estaba en IndexedDB en ese momento
5. Sync frecuente (cada 5 min) minimiza ventana de inconsistencia
6. Si es crítico: sincronizar productos del carrito antes de finalizar pedido

---

## TESTING STRATEGY

### Niveles de Testing

**1. Unit Tests (opcional, si hay tiempo)**

Usar Vitest o Jest:

- `cacheService.js`: Tests para cada función
- `syncService.js`: Mock Firestore, test lógica
- `productService.js`: Test búsqueda, filtrado
- `orderService.js`: Test validación, creación

**2. Integration Tests (recomendado)**

Usar Testing Library + Mock Firestore:

- Flujo completo de crear pedido
- Flujo completo de sincronización
- Flujo completo de búsqueda
- Manejo de errores

**3. E2E Tests (crítico)**

Usar Playwright o Cypress:

- Crear pedido online
- Crear pedido offline
- Búsqueda de productos
- Sincronización después de offline
- Conflictos de stock
- Página de estado del cliente

**4. Manual Testing (crítico)**

Tests exploratorios:

- Probar todos los edge cases listados arriba
- Probar con conexión real (no solo mocks)
- Probar con múltiples dispositivos simultáneos
- Probar con datos reales (1000+ productos)

### Checklist de Testing

Antes de deploy a producción, verificar:

- [ ] Búsqueda funciona online
- [ ] Búsqueda funciona offline
- [ ] Búsqueda < 50ms consistentemente
- [ ] Crear pedido < 100ms consistentemente
- [ ] Pedidos se sincronizan exitosamente online
- [ ] Pedidos se guardan correctamente offline
- [ ] Pedidos pendientes se sincronizan al volver online
- [ ] Delta sync descarga solo cambios
- [ ] Full sync descarga todo correctamente
- [ ] Timestamps se actualizan al modificar productos
- [ ] Conflictos de stock se detectan y manejan
- [ ] Página de estado funciona
- [ ] QR code se genera correctamente
- [ ] UI no cambió visualmente (screenshots)
- [ ] No hay console.logs en producción
- [ ] No hay memory leaks (Chrome DevTools)
- [ ] IndexedDB no crece infinitamente
- [ ] Funciona en Chrome, Firefox, Safari
- [ ] Funciona en móvil (iOS y Android)

---

## MÉTRICAS DE ÉXITO

### Métricas Técnicas

**Performance:**
- Tiempo de búsqueda: < 50ms (objetivo), < 100ms (aceptable)
- Tiempo de crear pedido: < 100ms (objetivo), < 200ms (aceptable)
- Tiempo de sincronización: < 5 segundos (objetivo), < 10 segundos (aceptable)
- Tiempo de full sync: < 30 segundos (objetivo), < 60 segundos (aceptable)

**Reliability:**
- Sync success rate: > 95% (objetivo), > 90% (aceptable)
- Uptime: > 99% (objetivo), > 95% (aceptable)
- Error rate: < 1% (objetivo), < 5% (aceptable)

**Efficiency:**
- Firestore reads per búsqueda: 0 (objetivo), 1 (aceptable)
- Firestore reads per delta sync: N cambios + 1 metadata (objetivo)
- IndexedDB storage: < 50MB (objetivo), < 100MB (aceptable)

### Métricas de Negocio

**Throughput:**
- Clientes atendidos por hora: 10+ (objetivo), 5+ (aceptable)
- Tiempo promedio por transacción: < 5 segundos (objetivo), < 10 segundos (aceptable)

**Experiencia del usuario:**
- Customer abandonment rate: < 5% (objetivo), < 10% (aceptable)
- Employee satisfaction: 8/10+ (objetivo), 6/10+ (aceptable)

**Operacional:**
- Costo Firestore por mes: < $10 (objetivo), < $50 (aceptable)
- Soporte tickets por semana: < 2 (objetivo), < 5 (aceptable)

### Comparación Antes/Después

| Métrica | Antes | Después (objetivo) | Mejora |
|---------|-------|-------------------|--------|
| Tiempo de búsqueda | 500-2000ms | < 50ms | 40x |
| Tiempo crear pedido | 30-60s | < 100ms | 600x |
| Throughput | 1 cliente/min | 10+ clientes/min | 10x |
| Funciona offline | ❌ No | ✅ Sí | N/A |
| Sobreventa | ⚠️ Común | ✅ Rara | N/A |
| Sync success rate | ~70% | > 95% | 36% ↑ |

---

## CONTINGENCIAS

### Plan B: Si Full Implementation Falla

Si por alguna razón la implementación completa no funciona:

**Rollback Strategy:**

1. Mantener branch `backup-before-offline-first`
2. Revertir deploy con un click
3. Tiempo de rollback: < 5 minutos
4. Cero pérdida de datos (pedidos en Firestore intactos)

**Implementación Parcial (Fallback):**

Si no podemos completar todo, priorizar:

1. **Mínimo viable (1 semana):**
   - Solo IndexedDB + búsqueda local
   - Pedidos siguen siendo sincrónicos (como antes)
   - Mejora: Búsqueda 40x más rápida
   - No mejora: Creación de pedidos

2. **Medio viable (2 semanas):**
   - IndexedDB + búsqueda local + delta sync
   - Pedidos siguen siendo sincrónicos
   - Mejora: Búsqueda rápida + catálogo siempre actualizado
   - No mejora: Creación de pedidos

3. **Casi completo (3 semanas):**
   - Todo menos manejo avanzado de conflictos
   - Pedidos optimistas funcionan
   - Conflictos se resuelven manualmente
   - Mejora: Todo excepto prevención de sobreventa

### Plan C: Si WiFi Mejora

Si durante la implementación el WiFi se arregla:

**Evaluar si vale la pena continuar:**

Sí, porque:
- Búsqueda local sigue siendo más rápida
- Offline support es valioso (cliente puede consultar desde casa)
- Escalabilidad futura (no dependemos de WiFi)
- Reducción de costos Firestore

**Ajustar prioridades:**
- Reducir enfoque en reliability
- Aumentar enfoque en performance
- Implementación más relajada (4 semanas en vez de 3)

### Plan D: Si Equipo Muy Pequeño

Si solo hay 1 developer y no da el tiempo:

**Contratar ayuda externa:**
- Freelancer con experiencia en IndexedDB + Firestore
- Pair programming para transfer knowledge
- Presupuesto estimado: $2000-5000 USD

**Extender timeline:**
- 6 semanas en vez de 3
- Implementación más cuidadosa
- Más testing, menos prisa

---

## CONCLUSIÓN

Esta estrategia transforma la aplicación de un modelo "online-only" frágil a un modelo "offline-first" robusto.

**Key takeaways:**

1. **Simplicidad del timestamp system**: No necesitamos colecciones extra, solo 2 campos
2. **Prioridad al empleado**: Nunca espera al WiFi, todo es instantáneo
3. **Cliente fuera de la cola**: QR code permite flujo asíncrono
4. **Sincronización inteligente**: Solo descarga lo que cambió
5. **Manejo de errores robusto**: Reintentos automáticos, rollback, notificaciones

**ROI esperado:**

- Inversión: 3 semanas de desarrollo
- Retorno: 10x más clientes atendidos por hora
- Payback: Inmediato (misma semana de deploy)

**Riesgos mitigados:**

- Dependencia de WiFi: ✅ Eliminada
- Sobreventa: ✅ Prevenida
- Búsquedas lentas: ✅ Solucionadas
- Clientes abandonando: ✅ Reducido drásticamente

**Próximos pasos:**

1. Aprobar esta estrategia
2. Comenzar FASE 0 (preparación)
3. Ejecutar fases secuencialmente
4. Deploy gradual con monitoreo
5. Iterar basado en feedback

---

*Documento vivo - se actualizará durante la implementación con learnings y ajustes.*
