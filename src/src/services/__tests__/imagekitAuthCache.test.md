# Manual Testing Guide - ImageKit Auth Cache

## 🧪 Test Suite

### Test 1: Primera Carga - Token Nuevo

**Steps:**
1. Abrir la app en incognito/private window (para limpiar cualquier caché del browser)
2. Abrir DevTools (F12) → Console tab
3. Ir a crear/editar producto
4. Subir una imagen

**Expected Output:**
```
[ImageKit Auth] Fetching new token from: https://...
[ImageKit Auth] Token cached (expires at HH:MM:SS)
[Upload] Compressing images...
[Upload] Getting authentication...
[Upload] Uploading to ImageKit...
[Upload] Success! Uploaded 1 image(s)
```

**✅ Pass Criteria:**
- Se ve "Fetching new token"
- Se ve "Token cached"
- Imagen sube exitosamente
- Se muestra en el preview

---

### Test 2: Upload Consecutivo - Usa Caché

**Steps:**
1. Inmediatamente después del Test 1
2. Subir otra imagen (cambiar o eliminar y subir nueva)
3. Observar la console

**Expected Output:**
```
[Upload] Compressing images...
[Upload] Getting authentication...
[ImageKit Auth] Using cached token (expires in XXXX s)
[Upload] Uploading to ImageKit...
[Upload] Success! Uploaded 1 image(s)
```

**✅ Pass Criteria:**
- Se ve "Using cached token"
- NO se ve "Fetching new token"
- Número de segundos es alto (>3400 si es recién cacheado)
- Imagen sube exitosamente

---

### Test 3: Múltiples Productos

**Steps:**
1. Crear 5 productos nuevos con imágenes
2. Observar los logs en console

**Expected Output:**
```
Producto 1:
[ImageKit Auth] Fetching new token...

Producto 2:
[ImageKit Auth] Using cached token...

Producto 3:
[ImageKit Auth] Using cached token...

Producto 4:
[ImageKit Auth] Using cached token...

Producto 5:
[ImageKit Auth] Using cached token...
```

**✅ Pass Criteria:**
- Solo 1 request de token para todos los productos
- Todos suben exitosamente
- En Vercel → Functions → `/api/auth` solo debe aparecer 1 invocación

---

### Test 4: Refresh después de tiempo

**Steps:**
1. Abrir la app
2. Subir una imagen (genera token)
3. Dejar la app abierta por 1 hora
4. Subir otra imagen

**Expected Output:**
```
[ImageKit Auth] Fetching new token from: ...
[ImageKit Auth] Token cached (expires at HH:MM:SS)
[Upload] Success! Uploaded 1 image(s)
```

**✅ Pass Criteria:**
- Después de 1 hora, obtiene nuevo token
- Upload sigue funcionando normalmente
- No hay errores

---

### Test 5: Verificar que NO hay breaking changes

**Steps:**
1. Probar todos los flujos normales de la app:
   - Crear producto con imagen
   - Editar producto y cambiar imagen
   - Ver productos existentes
   - Eliminar imagen
   - Subir imagen grande (>5MB)
   - Subir imagen pequeña (<1MB)

**Expected Output:**
- Todo funciona exactamente igual que antes
- Imágenes se siguen viendo en el inventario
- Preview funciona correctamente

**✅ Pass Criteria:**
- Ningún breaking change
- UX es idéntica
- Todas las features funcionan

---

### Test 6: Error Handling

**Steps:**
1. Apagar el servidor local de API (si estás en localhost)
2. O modificar temporalmente la URL del auth endpoint
3. Intentar subir imagen

**Expected Output:**
```
[ImageKit Auth] Fetching new token from: ...
[ImageKit Auth] Endpoint error: ...
[Upload] Error: Error al subir imagen: Failed to get authentication
```

**Resultado en UI:**
- Aparece mensaje de error al usuario
- Preview vuelve a la imagen anterior
- No se rompe la aplicación

**✅ Pass Criteria:**
- Error se maneja gracefully
- Usuario ve mensaje claro
- App no se crashea

---

### Test 7: Verificar Vercel Functions

**Steps:**
1. Deploy a Vercel (o esperar que auto-deploy)
2. Ir a Vercel Dashboard
3. Proyecto → Functions → `/api/auth`
4. Usar la app normalmente (subir 10 imágenes)
5. Esperar 5 minutos
6. Revisar el dashboard

**Expected Output:**
- Invocaciones de `/api/auth`: 1-2 (no 10)
- Duration: ~200-500ms
- Errors: 0

**✅ Pass Criteria:**
- Mucho menos invocaciones que antes
- ~90% de reducción
- Sin errores

---

## 🐛 Common Issues & Solutions

### Issue: "Using cached token" nunca aparece

**Possible causes:**
- Token expira muy rápido (check expire time)
- Buffer muy agresivo (check EXPIRY_BUFFER_MS)
- Cache se limpia entre uploads

**Debug:**
```javascript
// En console del browser:
import authCache from './services/imagekitAuthCache';
console.log(authCache.cache);
console.log(authCache.isTokenValid());
```

---

### Issue: Uploads fallan con auth errors

**Possible causes:**
- Token realmente expirado pero retry no funciona
- Credenciales de ImageKit incorrectas
- Red intermitente

**Debug:**
- Check console logs para ver el retry
- Verify que se ve "retrying with fresh token"
- Check .env variables

---

### Issue: "Fetching new token" en cada upload

**Possible causes:**
- Buffer muy agresivo (token se invalida muy rápido)
- Cache se limpia entre uploads
- Problema con Date.now() o expire time

**Debug:**
```javascript
// Verificar expire time:
const auth = await authCache.getAuthParams();
console.log('Expire:', new Date(auth.expire * 1000));
console.log('Now:', new Date());
console.log('Diff (seconds):', auth.expire - Math.floor(Date.now() / 1000));
```

---

## 📊 Success Metrics

After 1 week of production use:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Edge Requests Reduction | ~90% | Vercel Dashboard → Usage |
| Upload Success Rate | >99% | Monitor errors in console |
| User Complaints | 0 | Support tickets / feedback |
| Average Upload Time | Similar or better | User perception |

---

## ✅ Final Checklist

Antes de dar por completado el testing:

- [ ] Test 1: Token nuevo en primera carga ✓
- [ ] Test 2: Caché funciona en uploads consecutivos ✓
- [ ] Test 3: Múltiples productos usan mismo token ✓
- [ ] Test 4: Refresh automático después de tiempo ✓
- [ ] Test 5: No breaking changes en UX ✓
- [ ] Test 6: Error handling funciona ✓
- [ ] Test 7: Vercel Functions muestra reducción ✓
- [ ] Build production sin errores ✓
- [ ] Deploy exitoso ✓
- [ ] Monitoreo configurado ✓

---

**Status:** Ready for Production Testing
**Next Steps:** Deploy y monitorear por 1 semana
