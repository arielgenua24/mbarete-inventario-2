import  { createContext, useEffect, useState} from 'react';
import { sanitizeVariantInput } from '../utils/inputSanitizer';

const OrderContext = createContext();

// eslint-disable-next-line react/prop-types
const OrderProvider = ({ children }) => {

  const [nullCart, setNullCart] = useState(false);
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem('cart-r-v1.1');
    if (savedCart) {
      const parsedCart = JSON.parse(savedCart);
      // Sanitize existing cart data to fix legacy inconsistencies
      const sanitizedCart = parsedCart.map(item => ({
        ...item,
        selectedVariants: {
          size: sanitizeVariantInput(item.selectedVariants?.size),
          color: sanitizeVariantInput(item.selectedVariants?.color)
        }
      }));
      // Save sanitized cart back to localStorage
      localStorage.setItem('cart-r-v1.1', JSON.stringify(sanitizedCart));
      return sanitizedCart;
    }
    return [];
  });

  function findItem(cartItemOrProduct, sourceCart = cart) {
    const foundIndex = sourceCart.findIndex((cartItem) => {
      // Handle both old format (direct product) and new format (cart item with product)
      const searchId = cartItemOrProduct?.product?.id || cartItemOrProduct?.id;
      const cartId = cartItem?.product?.id || cartItem?.item?.id;
      
      // Si los IDs no coinciden, definitivamente no es el mismo item
      if (cartId !== searchId) return false;
      
      // Si los IDs coinciden, verificar variantes
      const searchVariants = cartItemOrProduct?.selectedVariants;
      const cartVariants = cartItem?.selectedVariants;
      
      // Si no hay variantes en ninguno, son iguales (backward compatibility)
      if (!searchVariants && !cartVariants) return true;
      
      // Casos especiales: uno tiene variantes y el otro no
      if (!searchVariants && cartVariants) {
        // Buscar sin variantes vs item con variantes = diferentes items
        return (cartVariants.size === null || cartVariants.size === '') && 
               (cartVariants.color === null || cartVariants.color === '');
      }
      
      if (searchVariants && !cartVariants) {
        // Buscar con variantes vs item sin variantes = diferentes items  
        return (searchVariants.size === null || searchVariants.size === '') && 
               (searchVariants.color === null || searchVariants.color === '');
      }
      
      // Comparar variantes específicas (ambos tienen variantes)
      return (
        searchVariants?.size === cartVariants?.size && 
        searchVariants?.color === cartVariants?.color
      );
    });
    if (foundIndex !== -1) {
      console.log('Found item:', sourceCart[foundIndex])
      return { item: sourceCart[foundIndex], index: foundIndex };
    }
    return null;
  }


    function addItem(cartItem, quantity) {
      // Handle both old format and new format
      let newCartItem;
      if (cartItem?.product) {
        // New format: cart item with product and variants
        newCartItem = cartItem;
      } else {
        // Old format: direct product - convert to new format
        newCartItem = {
          product: cartItem,
          quantity: quantity,
          selectedVariants: { size: null, color: null }
        };
      }
      
      setCart((prevCart) => {
        // Check if item already exists in cart using latest state snapshot
        const existingItem = findItem(newCartItem, prevCart);
        let nextCart;

        if (existingItem) {
          // Item exists - accumulate quantities
          console.log('Item already exists, accumulating quantities');
          const updatedQuantity = existingItem.item.quantity + newCartItem.quantity;
          nextCart = [...prevCart];
          nextCart[existingItem.index] = {
            ...existingItem.item,
            quantity: updatedQuantity
          };
        } else {
          // Item doesn't exist - add as new item
          console.log('añadiendo items al carrito en el localStorage');
          console.log(newCartItem);
          nextCart = [...prevCart, newCartItem];
        }

        localStorage.setItem('cart-r-v1.1', JSON.stringify(nextCart));
        return nextCart;
      });
    }

    function updateQuantity(cartItem, quantity, originalVariants = null) {
      console.log('ejecutando la funcion updateQuantity')
      console.log('cartItem:', cartItem)
      console.log('originalVariants:', originalVariants)
      
      // Si no se proporcionan variantes originales, asumir que son las mismas que las actuales
      const variantesToFind = originalVariants || cartItem.selectedVariants || { size: null, color: null };
      
      const originalItemToFind = {
        product: cartItem.product || cartItem,
        selectedVariants: variantesToFind
      };
      
      const foundItem = findItem(originalItemToFind);
      console.log('oldCart encontrado:', foundItem)
      
      if (foundItem) {
        // Verificar si las variantes cambiaron
        const newVariants = cartItem.selectedVariants || { size: null, color: null };
        const variantsChanged = (
          variantesToFind.size !== newVariants.size || 
          variantesToFind.color !== newVariants.color
        );
        
        console.log('¿Variantes cambiaron?', variantsChanged);
        console.log('Originales:', variantesToFind);
        console.log('Nuevas:', newVariants);
        
        if (!variantsChanged) {
          // Actualización simple - mismas variantes
          const newCart = [...cart];
          const updatedItem = {
            product: cartItem.product,
            quantity: quantity,
            selectedVariants: newVariants
          };
          
          newCart[foundItem.index] = updatedItem;
          setCart(newCart);
          localStorage.setItem('cart-r-v1.1', JSON.stringify(newCart));
          console.log('✅ Actualizado sin cambio de variantes');
        } else {
          // Caso 2: Las variantes cambiaron - eliminar el viejo y agregar el nuevo
          console.log('🔄 Variantes cambiaron - eliminando item original y agregando nuevo');
          
          // Eliminar el item original
          const newCart = [...cart];
          newCart.splice(foundItem.index, 1);
          
          // Agregar el nuevo item con las variantes actualizadas
          const newCartItem = {
            product: cartItem.product,
            quantity: quantity,
            selectedVariants: newVariants
          };
          
          newCart.push(newCartItem);
          
          setCart(newCart);
          localStorage.setItem('cart-r-v1.1', JSON.stringify(newCart));
          console.log('✅ Item reemplazado con nuevas variantes');
        }
      } else {
        console.log('❌ No se encontró el item original para actualizar');
      }
    }

    function finditems() {
      let parsedItems = JSON.parse(localStorage.getItem('cart-r-v1.1'))
      return parsedItems
    }

    function deleteItem(cartItemOrProduct) {
      const foundItem = findItem(cartItemOrProduct);
      if(foundItem) {
        console.log('delete item', cartItemOrProduct)
        const newCart = [...cart];
        newCart.splice(foundItem.index, 1)
        localStorage.setItem('cart-r-v1.1', JSON.stringify(newCart))
        setCart(newCart); 
      }
    }

    function clearCartData(){
      localStorage.removeItem('cart-r-v1.1');
    }


    const getInitialOrder = () => {
      const savedOrder = localStorage.getItem('customer-reina-v1.2');
      return savedOrder ? JSON.parse(savedOrder) : {
        customerName: '',
        phone: '',
        address: '',
        products: cart,
      };
    };
    
    // Luego, usa esta función en el useState
    const [order, setOrder] = useState(getInitialOrder());  

    useEffect(() => {
      setOrder((prevState) => ({
        ...prevState, // Propaga las propiedades existentes de `order`
        products: cart, // Actualiza la propiedad `products` con el nuevo valor de `cart`
      }));
    }, [cart]);


    function clearCustomerData() {
      localStorage.removeItem('customer-reina-v1.2');
    }

    function getCustomerData() {
      return JSON.parse(localStorage.getItem('customer-reina-v1.2'));
    }


    function resetOrderValues(){
      clearCustomerData();
      clearCartData();
      setCart([])
      setOrder({
        customerName: '',
        phone: '',
        address: '',
        products: [],
      })
      setIsMeli(false);
      localStorage.removeItem('order-is-meli');
    }

    useEffect(() => {
      function addCustomerData() {
        localStorage.setItem('customer-reina-v1.2', JSON.stringify(order));
      }
      addCustomerData()
      console.log(getCustomerData())
    }, [order]);

    const [ordersState, setOrdersState] = useState([])
    const [isMeli, setIsMeli] = useState(() => {
      return localStorage.getItem('order-is-meli') === 'true';
    });

    useEffect(() => {
      localStorage.setItem('order-is-meli', String(isMeli));
    }, [isMeli]);

  return (
    <OrderContext.Provider value={{ order, setCart, resetOrderValues,setNullCart, setOrder, addItem, updateQuantity, deleteItem, findItem, finditems, cart, clearCustomerData, getCustomerData, setOrdersState, ordersState, isMeli, setIsMeli }}>
      {children}
    </OrderContext.Provider>
  );
};

export { OrderContext, OrderProvider };
