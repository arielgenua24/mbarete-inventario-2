import { useState } from "react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { db } from "../../firebaseSetUp";

 // Importa la configuración de Firebase
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  increment,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  serverTimestamp,
  writeBatch,
  runTransaction
} from "firebase/firestore";


const useFirestore = () => {
  const currentDate = new Date();
  const formattedDate = format(currentDate, 'yyyy-MM-dd HH:mm:ss', { locale: es });

  const getAdmin = async() => {
    try{
      const coleccionRef = collection(db, "users");
      const querySnapshot = await getDocs(coleccionRef);
      if (!querySnapshot.empty) {
        // 3. Obtiene el primer (y único) documento de la colección
        const document = querySnapshot.docs[0];
  
        // 4. Obtiene los datos del documento
        const data = document.data();
  
        return data.admin; // Devuelve los datos para usarlos en tu aplicación
      } else {
        console.log("No se encontró ningún documento en la colección.");
        return undefined; // O algún otro valor por defecto si la colección está vacía
      }
    } catch (error) {
      console.error("Error al obtener el documento:", error);
      throw error
    }
   

  }

  //OKAY, producto agregado
  const addProduct = async (name, price, details, stock, imageUrl = null) => {
    try {
        //obtenemos el codigo de el producto
    const productCode = await incrementProductCode();
    console.log(productCode);

    // Convertir campos relevantes a minúsculas si son strings
    const processedName = typeof name === 'string' ? name.toLowerCase() : name;
    const processedDetails = typeof details === 'string' ? details : details;

      const productData = {
        productCode, // productCode usualmente tiene un formato específico, no se convierte
        name: processedName,
        price, // price es un número, no se convierte
        details: processedDetails,
        stock, // stock es un número, no se convierte
        updatedAt: serverTimestamp(), // Use Firestore server timestamp for delta sync
        createdAt: formattedDate, // Keep formatted date for display purposes
      };

      // Add imageUrl only if it exists
      if (imageUrl) {
        productData.imageUrl = imageUrl;
      }

      const docRef = await addDoc(collection(db, "products"), productData);
      console.log("Producto agregado con ID: ", docRef.id);
      const productId = docRef.id;

      // Update metadata/catalog to track global changes
      const metadataRef = doc(db, 'metadata', 'catalog');
      await setDoc(metadataRef, {
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      return productId;
    } catch (e) {
      console.error("Error agregando producto: ", e);
    }
  };

  // Obtener products con paginación
  const getProducts = async (limitParam = 10, startAfterDoc = null) => { 
    try {
      const productsRef = collection(db, "products");
      let q; 

      if (startAfterDoc) {
        // Si hay un documento de inicio, paginar desde ahí
        q = query(productsRef, orderBy("productCode"), startAfter(startAfterDoc), limit(limitParam));
      } else {
        // Si es la primera página, empezar desde el principio
        q = query(productsRef, orderBy("productCode"), limit(limitParam));
      }

      const productsSnapshot = await getDocs(q); 
      const productsData = productsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const lastVisibleDoc = productsSnapshot.docs[productsSnapshot.docs.length - 1]; 

      return { products: productsData, lastVisibleDoc }; 
    } catch (error) {
      console.error("Error al obtener products:", error);
      throw error;
    }
  };

  // Obtener un producto por ID
  const getProduct = async (productId) => {
    console.log(productId);
    try {
      const productRef = doc(db, "products", productId);
      const productSnap = await getDoc(productRef);
      console.log(productSnap.data());
      if (productSnap.data() !== undefined) {
        return {productRef, id: productSnap.id, ...productSnap.data() };
      } else {
        return undefined;      }
    } catch (error) {
      console.error("Error al obtener el producto:", error);
      throw error;
    }
  };


  const updateProduct = async (productId, values) => {
    const { productRef } = await getProduct(productId);
    console.log(productRef);

    // Use writeBatch to update both product and metadata atomically
    const batch = writeBatch(db);

    // Update the product with server timestamp
    batch.update(productRef, {
      ...values,
      updatedAt: serverTimestamp(),
    });

    // Update metadata/catalog to track global changes
    const metadataRef = doc(db, 'metadata', 'catalog');
    batch.set(metadataRef, {
      lastUpdated: serverTimestamp(),
    }, { merge: true });

    return batch.commit();
  }

  const deleteProduct = async (productId) => {
    try {
      const { productRef } = await getProduct(productId);
      await deleteDoc(productRef);
      return true; // Para indicar que la eliminación fue exitosa
    } catch (error) {
      console.error("Error al eliminar el producto:", error);
      throw error; // Propaga el error para manejarlo en el componente
    }
  };
  


//Ejecutaremos esta funcion una vez el usuario llego a la instacia final de la orden
  
    // Obtener todos los orders
    const getOrders = async () => {
      try {
        const ordersSnapshot = await getDocs(collection(db, "orders"));
        const orders = ordersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        return orders;
      } catch (error) {
        console.error("Error al obtener orders:", error);
        throw error;
      }
    };

    // Paginated orders, sorted by createdAt descending
    const getOrdersPaginated = async (limitParam = 10, startAfterDoc = null) => {
      try {
        const ordersRef = collection(db, "orders");
        let q;

        if (startAfterDoc) {
          q = query(ordersRef, orderBy("createdAt", "desc"), startAfter(startAfterDoc), limit(limitParam));
        } else {
          q = query(ordersRef, orderBy("createdAt", "desc"), limit(limitParam));
        }

        const ordersSnapshot = await getDocs(q);
        const ordersData = ordersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const lastVisibleDoc = ordersSnapshot.docs[ordersSnapshot.docs.length - 1];

        return { orders: ordersData, lastVisibleDoc };
      } catch (error) {
        console.error("Error al obtener orders paginados:", error);
        throw error;
      }
    };

    const filterOrdersByDate = async() => {
      const orders = await getOrders();

      // Ordenar el array (maneja tanto formato antiguo como nuevo)
      const filteredOrders = orders.sort((a, b) => {
        // Función para obtener fecha como Date object
        function getOrderDate(order) {
          // Formato nuevo: createdAt (Firestore Timestamp)
          if (order.createdAt) {
            // Si es un Timestamp de Firestore
            if (order.createdAt.toDate) {
              return order.createdAt.toDate();
            }
            // Si ya es un Date object
            if (order.createdAt instanceof Date) {
              return order.createdAt;
            }
            // Si es un string ISO
            return new Date(order.createdAt);
          }

          // Formato antiguo: fecha (string español "24/01/2025, 18:19")
          if (order.fecha) {
            const [datePart, timePart] = order.fecha.split(', ');
            const [day, month, year] = datePart.split('/');
            const formattedDate = `${year}-${month}-${day}`;
            return new Date(`${formattedDate}T${timePart}`);
          }

          // Fallback: usar fecha actual si no hay ninguna
          console.warn('Order without valid date:', order);
          return new Date(0); // Época Unix (muy antigua)
        }

        // Convertir las fechas a objetos Date válidos
        const dateA = getOrderDate(a);
        const dateB = getOrderDate(b);

        // Ordenar de más reciente a más antiguo
        return dateB - dateA;
      });

      console.log('Filtered orders:', filteredOrders);
      return filteredOrders;
    }

    /**
     * Delete an order and restore stock to products.
     *
     * Handles both data formats:
     * - New format: products embedded as array in order document (order.products)
     * - Old format: products only in subcollection (orders/{orderId}/products)
     *
     * CRITICAL: Aggregates quantities by productId before restoring stock.
     * Multiple variants of the same product (e.g., "buzo azul talle L" + "buzo azul talle S")
     * map to a single productId in the products collection, so their quantities must be summed.
     *
     * Uses a Firestore transaction to ensure atomicity of stock restoration.
     * Subcollection cleanup happens after the transaction.
     *
     * @param {string} orderId - The Firestore document ID of the order to delete
     * @returns {Promise<Object>} - { success: true, restoredProducts: [...] } or throws
     */
    const deleteOrder = async (orderId) => {
      try {
        console.log(`🗑️ Deleting order ${orderId} with stock restoration...`);

        const orderDocRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderDocRef);

        if (!orderSnap.exists()) {
          console.warn(`⚠️ Order ${orderId} does not exist, nothing to delete`);
          return { success: true, restoredProducts: [] };
        }

        const orderData = orderSnap.data();

        // ============================================
        // STEP 1: Get products from order (handle both formats)
        // ============================================
        let orderProducts = [];

        if (orderData.products && Array.isArray(orderData.products) && orderData.products.length > 0) {
          // NEW FORMAT: Products embedded as array in order document
          console.log(`📦 Order has embedded products array (${orderData.products.length} items)`);
          orderProducts = orderData.products.map(p => ({
            productId: p.productId,
            quantity: Number(p.quantity) || 0,
            name: p.productSnapshot?.name || 'Unknown'
          }));
        } else {
          // OLD FORMAT: Products only in subcollection
          console.log(`📁 Order uses old format, reading products from subcollection...`);
          const subcollectionSnap = await getDocs(
            collection(db, "orders", orderId, "products")
          );

          if (!subcollectionSnap.empty) {
            orderProducts = subcollectionSnap.docs.map(productDoc => {
              const data = productDoc.data();
              return {
                productId: data.productId || null,
                quantity: Number(data.stock) || 0, // In subcollection, "stock" = quantity ordered
                name: data.productSnapshot?.name || data.productData?.name || 'Unknown'
              };
            });
          }
        }

        if (orderProducts.length === 0) {
          console.warn(`⚠️ Order ${orderId} has no products to restore stock for`);
          // Still delete the order and subcollection
          await deleteDoc(orderDocRef);
          console.log(`✅ Order ${orderId} deleted (no stock to restore)`);
          return { success: true, restoredProducts: [] };
        }

        // ============================================
        // STEP 2: Aggregate quantities by productId
        // ============================================
        // CRITICAL: Multiple variants of the same product (e.g., "buzo azul talle L"
        // and "buzo azul talle S") share the same productId. We must SUM their
        // quantities before restoring stock, because there's only ONE stock field
        // per product in Firestore.
        const stockRestoreMap = new Map();

        for (const product of orderProducts) {
          const productId = product.productId;

          if (!productId) {
            console.warn(`⚠️ Skipping product without productId:`, product);
            continue;
          }

          if (product.quantity <= 0) {
            console.warn(`⚠️ Skipping product with invalid quantity:`, product);
            continue;
          }

          if (stockRestoreMap.has(productId)) {
            const existing = stockRestoreMap.get(productId);
            existing.totalQuantity += product.quantity;
            console.log(`📊 Aggregating variant for "${product.name}": total restore = ${existing.totalQuantity}`);
          } else {
            stockRestoreMap.set(productId, {
              productId,
              productRef: doc(db, "products", productId),
              totalQuantity: product.quantity,
              name: product.name
            });
          }
        }

        const productsToRestore = Array.from(stockRestoreMap.values());
        console.log(`📦 Products to restore stock (${productsToRestore.length} unique products):`);
        productsToRestore.forEach(p => {
          console.log(`   - ${p.name} (${p.productId}): +${p.totalQuantity}`);
        });

        // ============================================
        // STEP 3: Restore stock atomically via transaction
        // ============================================
        const restoredProducts = await runTransaction(db, async (transaction) => {
          // PHASE 1: ALL READS FIRST (Firestore transaction requirement)
          const productSnapshots = [];
          for (const productToRestore of productsToRestore) {
            const productSnap = await transaction.get(productToRestore.productRef);
            productSnapshots.push({
              snap: productSnap,
              restoreData: productToRestore
            });
          }

          // PHASE 2: ALL WRITES
          const restored = [];

          for (const { snap, restoreData } of productSnapshots) {
            if (!snap.exists()) {
              // Product was deleted from inventory — skip silently
              console.warn(`⚠️ Product ${restoreData.productId} ("${restoreData.name}") no longer exists in Firestore. Skipping stock restore.`);
              continue;
            }

            const currentStock = Number(snap.data().stock) || 0;
            const newStock = currentStock + restoreData.totalQuantity;

            transaction.update(restoreData.productRef, {
              stock: newStock,
              updatedAt: serverTimestamp()
            });

            console.log(`✅ Stock restore: ${restoreData.name} (${restoreData.productId}): ${currentStock} → ${newStock} (+${restoreData.totalQuantity})`);
            restored.push({
              productId: restoreData.productId,
              name: restoreData.name,
              previousStock: currentStock,
              restoredQuantity: restoreData.totalQuantity,
              newStock
            });
          }

          // Delete the order document inside the transaction
          transaction.delete(orderDocRef);

          return restored;
        });

        // ============================================
        // STEP 4: Delete subcollection documents
        // ============================================
        // Firestore does NOT cascade-delete subcollections when parent is deleted.
        // We must delete them manually.
        try {
          const subcollectionSnap = await getDocs(
            collection(db, "orders", orderId, "products")
          );

          if (!subcollectionSnap.empty) {
            const batch = writeBatch(db);
            subcollectionSnap.docs.forEach(subDoc => {
              batch.delete(subDoc.ref);
            });
            await batch.commit();
            console.log(`🗑️ Deleted ${subcollectionSnap.size} subcollection documents`);
          }
        } catch (subError) {
          // Non-fatal: subcollection cleanup failed but order + stock are already correct
          console.warn(`⚠️ Failed to clean up subcollection for order ${orderId}:`, subError);
        }

        // ============================================
        // STEP 5: Update metadata catalog
        // ============================================
        try {
          const metadataRef = doc(db, 'metadata', 'catalog');
          await setDoc(metadataRef, { lastUpdated: serverTimestamp() }, { merge: true });
        } catch (metaError) {
          console.warn(`⚠️ Failed to update metadata:`, metaError);
        }

        console.log(`✅ Order ${orderId} deleted successfully. Stock restored for ${restoredProducts.length} products.`);
        return { success: true, restoredProducts };
      } catch (error) {
        console.error("❌ Error deleting order with stock restoration:", error);
        throw error;
      }
    };

    const updateOrder = async (orderId, updateData) => {
      try {
        const orderDocRef = doc(db, "orders", orderId);
        await updateDoc(orderDocRef, 
          updateData,
        );
        console.log("Order updated successfully");
        return true; // Indica que la actualización fue exitosa
      } catch (error) {
        console.error("Error updating order:", error);
        throw error;
      }
    };


    const getOrderById = async (orderId) => {
      console.log(orderId)
      try {
        const orderDocRef = doc(db, "orders", orderId);
        const orderSnapshot = await getDoc(orderDocRef);
        
        if (orderSnapshot.exists()) {
          return { id: orderSnapshot.id, ...orderSnapshot.data() };
        } else {
          console.error("No such order exists");
          return null;
        }
      } catch (error) {
        console.error("Error fetching order:", error);
        throw error;
      }
    };

    const getProductsByOrder = async (orderId) => {
      try {
          // Obtener subcolección de productos
          const productsSnapshot = await getDocs(collection(db, "orders", orderId, "products"));
  
          // Mapear los productos sin volver a consultar el inventario
          const products = productsSnapshot.docs.map((productDoc) => {
              const productData = productDoc.data();
              
              return {
                  id: productDoc.id,
                  ...productData,
                  productData: productData.productSnapshot, // Usamos el snapshot en vez de consultar Firestore
              };
          });
  
          return products;
      } catch (error) {
          console.error("Error fetching order products: ", error);
          throw error;
      }
  };
  



  // Incrementar el código del producto (ej: #001, #002)
  const incrementProductCode = async () => {
    try {
      const codeRef = doc(db, "counters", "productCode");
      const codeSnap = await getDoc(codeRef);
      console.log(codeSnap);
      if (codeSnap.exists()) {
        const currentCode = codeSnap.data().value;
        await updateDoc(codeRef, {
          value: increment(1),
        });
        return `#${String(currentCode).padStart(3, "0")}`;
      } else {
        // Si no existe el documento, crearlo
        await setDoc(codeRef, { value: 2 });
        return "#001";
      }
    } catch (error) {
      console.error("Error al incrementar el código del producto:", error);
      throw error;
    }
  };

  // Incrementar el código del pedido (ej: #001, #002)
  const incrementOrdersCode = async () => {
    try {
        const codeRef = doc(db, "counters", "orderCode");
        const codeSnap = await getDoc(codeRef);
        
        if (codeSnap.exists()) {
          const currentCode = codeSnap.data().value;
          await updateDoc(codeRef, {
            value: increment(1)
          });
          return `#${String(currentCode).padStart(3, "0")}`;
        } else {
          // Si no existe el documento, crearlo
          await setDoc(codeRef, { value: 2 });
          return "#001";
        }
      } catch (error) {
        console.error("Error al incrementar el código del pedido:", error);
        throw error;
      }
  };

  const createOrderWithProducts = async (fecha, cliente, telefono, direccion, products) => {  
    console.log('llamado exitoso');
    console.log(fecha, cliente, telefono, direccion, products);
  
    try {
        // Aggregate requested quantities by product ID to avoid overwriting stock
        // when the same product appears in multiple variants.
        const aggregatedByProduct = {};

        for (const element of products) {
            const product = element.product || element.item;
            const productId = product?.id;
            const quantityNumber = Number(element.quantity);

            if (!productId) {
                console.error('Producto inválido en el pedido:', element);
                return false;
            }

            if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
                console.error(`Cantidad inválida para ${productId}:`, element.quantity);
                return false;
            }

            if (!aggregatedByProduct[productId]) {
                aggregatedByProduct[productId] = {
                    totalRequested: 0,
                    productRef: doc(db, "products", productId),
                };
            }

            aggregatedByProduct[productId].totalRequested += quantityNumber;
        }

        // Validate stock once per product with aggregated quantity
        const productSnapshots = {};
        for (const [productId, aggregate] of Object.entries(aggregatedByProduct)) {
            const productSnapshot = await getDoc(aggregate.productRef);

            if (!productSnapshot.exists()) {
                console.error(`Producto ${productId} no existe`);
                return false;
            }

            const currentStock = Number(productSnapshot.data().stock) || 0;
            if (currentStock < aggregate.totalRequested) {
                console.error(`Stock insuficiente para ${productId}. Pedido total: ${aggregate.totalRequested}, stock: ${currentStock}`);
                return false;
            }

            productSnapshots[productId] = {
                snapshot: productSnapshot,
                currentStock,
                productRef: aggregate.productRef
            };
        }

        const orderCode = await incrementOrdersCode();
        // Crear el pedido en la colección "orders"
        const pedidoRef = await addDoc(collection(db, "orders"), {
            orderCode,
            fecha,
            cliente,
            telefono,
            direccion,
            estado: "pendiente",
        });

        // Guardar cada línea del pedido (incluye variantes)
        for (const element of products) {
            // Handle both old format (element.item) and new format (element.product)
            const product = element.product || element.item;
            const productId = product.id;
            const snapshotEntry = productSnapshots[productId];

            if (!snapshotEntry?.snapshot?.exists()) {
                console.error(`Snapshot no encontrado para ${productId}`);
                return false;
            }

            const productData = snapshotEntry.snapshot.data();
            const productRef = snapshotEntry.productRef;
            console.log(productData);
            
            const quantityNumber = Number(element.quantity);

            // ⚡ Guardar snapshot del producto en la orden con variantes seleccionadas
            const orderProduct = {
                productRef, // Se mantiene la referencia por si se necesita
                productSnapshot: { // Snapshot de los datos actuales del producto
                    name: productData.name,
                    price: productData.price,
                    productCode: productData.productCode,
                    details: productData.details || '',
                },
                stock: quantityNumber,
                verified: 0
            };
            
            // Add selected variants if they exist (new format)
            if (element.selectedVariants) {
                orderProduct.selectedVariants = {
                    size: element.selectedVariants.size || null,
                    color: element.selectedVariants.color || null
                };
            } else {
                // Backward compatibility: if it's old format, try to get size/color from product data
                orderProduct.selectedVariants = {
                    size: productData.size || null,
                    color: productData.color || null
                };
            }
            
            await addDoc(collection(db, `orders/${pedidoRef.id}/products`), orderProduct);
        }

        // Actualizar stock una sola vez por producto agregado (sumado)
        for (const [productId, aggregate] of Object.entries(aggregatedByProduct)) {
            const snapshotEntry = productSnapshots[productId];
            const newStockInt = snapshotEntry.currentStock - aggregate.totalRequested;
            await updateDoc(snapshotEntry.productRef, {
                stock: newStockInt
            });
        }

        return pedidoRef.id;
    } catch (error) {
        console.error("Error en el procesamiento del pedido:", error);
        return false;
    }
};



  // Nueva función para buscar productos por nombre o código
  const searchProductsByNameOrCode = async (searchTerm, limitParam = 10) => {
    console.log(`[searchProductsByNameOrCode] Received search term: "${searchTerm}"`); // <-- Log inicial
    if (!searchTerm || !searchTerm.trim()) {
      console.log("[searchProductsByNameOrCode] Search term is empty, returning empty array.");
      return [];
    }

    const productsRef = collection(db, "products");
    const searchTermClean = searchTerm.trim(); // Usar término sin espacios extra
    const searchTermLower = searchTermClean.toLowerCase();
    const searchTermUpper = searchTermClean.toUpperCase();

    const endTermLower = searchTermLower.slice(0, -1) + String.fromCharCode(searchTermLower.charCodeAt(searchTermLower.length - 1) + 1);
    const endTermUpper = searchTermUpper.slice(0, -1) + String.fromCharCode(searchTermUpper.charCodeAt(searchTermUpper.length - 1) + 1);

    // --- Log de los términos y rangos ---
    console.log(`[searchProductsByNameOrCode] Cleaned Term: "${searchTermClean}"`);
    console.log(`[searchProductsByNameOrCode] Lower Range: >= "${searchTermLower}" AND < "${endTermLower}"`);
    console.log(`[searchProductsByNameOrCode] Upper Range: >= "${searchTermUpper}" AND < "${endTermUpper}"`);


    // --- Consultas ---
    const nameQueryLower = query(
      productsRef,
      where("name", ">=", searchTermLower),
      where("name", "<", endTermLower),
      limit(limitParam)
    );
    const nameQueryUpper = query(
      productsRef,
      where("name", ">=", searchTermUpper),
      where("name", "<", endTermUpper), // Corregido de endTermLower a endTermUpper
      limit(limitParam)
    );
    const codeQueryLower = query(
      productsRef,
      where("productCode", ">=", searchTermLower), // Asumimos case-insensitive para código también
      where("productCode", "<", endTermLower),
      limit(limitParam)
    );
    const codeQueryUpper = query(
      productsRef,
      where("productCode", ">=", searchTermUpper),
      where("productCode", "<", endTermUpper),
      limit(limitParam)
    );


    try {
      console.log("[searchProductsByNameOrCode] Executing Firestore queries...");
      const [nameSnapLower, nameSnapUpper, codeSnapLower, codeSnapUpper] = await Promise.all([
        getDocs(nameQueryLower),
        getDocs(nameQueryUpper),
        getDocs(codeQueryLower),
        getDocs(codeQueryUpper),
      ]);
      console.log("[searchProductsByNameOrCode] Queries finished.");

      // --- Log de resultados por consulta ---
      console.log(`[searchProductsByNameOrCode] Name Lower Hits: ${nameSnapLower.docs.length}`, nameSnapLower.docs.map(d => ({id: d.id, ...d.data()})));
      console.log(`[searchProductsByNameOrCode] Name Upper Hits: ${nameSnapUpper.docs.length}`, nameSnapUpper.docs.map(d => ({id: d.id, ...d.data()})));
      console.log(`[searchProductsByNameOrCode] Code Lower Hits: ${codeSnapLower.docs.length}`, codeSnapLower.docs.map(d => ({id: d.id, ...d.data()})));
      console.log(`[searchProductsByNameOrCode] Code Upper Hits: ${codeSnapUpper.docs.length}`, codeSnapUpper.docs.map(d => ({id: d.id, ...d.data()})));


      // Combinar y eliminar duplicados
      const combinedResults = new Map();
      const processSnapshot = (snapshot) => {
        snapshot.docs.forEach(doc => {
          if (!combinedResults.has(doc.id)) {
            combinedResults.set(doc.id, { id: doc.id, ...doc.data() });
          }
        });
      };

      processSnapshot(nameSnapLower);
      processSnapshot(nameSnapUpper);
      processSnapshot(codeSnapLower);
      processSnapshot(codeSnapUpper);

      const finalResults = Array.from(combinedResults.values());
      console.log(`[searchProductsByNameOrCode] Final combined results count: ${finalResults.length}`);
      // console.log("[searchProductsByNameOrCode] Final combined results:", finalResults); // Log detallado opcional si el anterior no es suficiente

      return finalResults;

    } catch (error) {
      // --- Log de errores detallado ---
      console.error("[searchProductsByNameOrCode] Error searching products:", error);
      console.error("[searchProductsByNameOrCode] Error Code:", error.code); // Código de error de Firestore
      console.error("[searchProductsByNameOrCode] Error Message:", error.message); // Mensaje de error
      return [];
    }
  };

  // Nueva función para obtener todos los productos sin paginación
  const getAllProducts = async () => {
    try {
      const productsRef = collection(db, "products");
      // Ordenamos por productCode para mantener consistencia, aunque no es estrictamente necesario
      // si no se va a paginar. Puede ser útil para debug o si se decide añadir un límite en el futuro.
      const q = query(productsRef, orderBy("productCode")); 
      
      const productsSnapshot = await getDocs(q);
      const productsData = productsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      return productsData; // Devuelve un array de productos
    } catch (error) {
      console.error("Error al obtener todos los productos:", error);
      throw error;
    }
  };

  const [user, setUser] = useState(false);

  return {
    getOrders,
    getOrdersPaginated,
    createOrderWithProducts,
    addProduct,
    getProducts, // La función original con paginación
    getAllProducts, // La nueva función sin paginación
    getProduct,
    deleteProduct,
    incrementProductCode,
    incrementOrdersCode,
    updateProduct,
    getOrderById,
    filterOrdersByDate,
    updateOrder,
    deleteOrder,
    getProductsByOrder,
    user, setUser, getAdmin,
    searchProductsByNameOrCode
  };
};

export default useFirestore;
