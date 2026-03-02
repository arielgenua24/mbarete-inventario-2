# TODO — Producción: mbarete-inventory-2

Lista de tareas pendientes antes / durante el lanzamiento a producción.

---

## ✅ PENDIENTES

### 1. Configurar Admin en Firestore
**Estado:** ⏳ Pendiente
**Admin:** `mariajoseruizdiaz41@gmail.com`

**Cómo funciona:**
El sistema lee el admin desde Firestore — colección `users`, primer documento, campo `admin`.
No está hardcodeado en el código.

**Pasos:**
1. Ir a [Firebase Console](https://console.firebase.google.com) → proyecto `mbarete-inventario`
2. Firestore Database → colección `users`
3. Si ya existe un documento → editar el campo `admin` con el email
4. Si no existe ningún documento → crear uno con:
   ```
   Campo:  admin
   Tipo:   string
   Valor:  mariajoseruizdiaz41@gmail.com
   ```

> ⚠️ Sin este paso, nadie tendrá permisos de admin en la app y funciones como editar productos estarán bloqueadas.

---

## 🔜 PRÓXIMAS TAREAS

*(agregar acá lo que surja)*

---

## ✅ COMPLETADAS

*(mover acá las tareas cuando estén listas)*
