import { useState, useEffect, useMemo } from 'react';
import { useOrder } from '../../hooks/useOrder';
import useLocalOrders from '../../hooks/useLocalOrders';
import OrderCard from '../../components/OrderCard';
import OrderSummary from '../../components/OrderSumary';
import { useNavigate } from 'react-router-dom';
import LoadingComponent from '../../components/Loading';
import ImageModal from '../../components/ImageModal';
import './styles.css'; // Import new Airbnb styles

const Cart = () => {
  const { cart, order, resetOrderValues, isMeli } = useOrder();
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { createOrder, isCreating } = useLocalOrders();

  const [products, setProduct] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const navigate = useNavigate();

  // Calculate Total Price (use meli price if this is a meli sale)
  const totalPrice = cart.reduce((acc, item) => {
    const product = item.product || item.item;
    const price = isMeli
      ? (product?.meliPrice ?? product?.price ?? 0)
      : (product?.price ?? 0);
    const quantity = item.quantity || 1;
    return acc + (price * quantity);
  }, 0);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  useEffect(() => {
    if (cart) {
      setProduct(cart);
    }
  }, [cart]);

  // Group cart items by product ID to detect shared-stock conflicts
  const groupedProducts = useMemo(() => {
    const groups = {};
    products.forEach((item) => {
      const product = item.product || item.item;
      const id = product?.id;
      if (!id) return;
      if (!groups[id]) {
        groups[id] = {
          name: product.name,
          stock: Number(product.stock || 0),
          productId: id,
          items: [],
          totalRequested: 0,
        };
      }
      groups[id].items.push(item);
      groups[id].totalRequested += Number(item.quantity || 1);
    });
    return groups;
  }, [products]);

  // Check if any group exceeds stock (single items OR grouped variants)
  const hasStockConflict = useMemo(() => {
    return Object.values(groupedProducts).some(
      (group) => group.totalRequested > group.stock
    );
  }, [groupedProducts]);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(false);
    setErrorMessage('');

    // Validate cart not empty
    if (cart.length < 1) {
      setError(true);
      setErrorMessage('El carrito está vacío');
      setIsLoading(false);
      return null;
    }

    // Validate aggregated stock before submitting
    const stockErrors = Object.values(groupedProducts)
      .filter((g) => g.totalRequested > g.stock)
      .map(
        (g) =>
          `"${g.name}": pediste ${g.totalRequested} pero solo hay ${g.stock} en stock`
      );

    if (stockErrors.length > 0) {
      setError(true);
      setErrorMessage(
        `Stock insuficiente:\n${stockErrors.join('\n')}\n\nAjustá las cantidades antes de finalizar.`
      );
      setIsLoading(false);
      window.scrollTo(0, 0);
      return null;
    }

    const customerData = {
      customerName: order.customerName || 'Cliente sin nombre',
      phone: order.phone || 'Sin teléfono',
      address: order.address || 'Sin dirección'
    };

    console.log('🚀 Creating optimistic order with cart:', cart);

    try {
      const result = await createOrder({ ...customerData, isMeli }, cart);

      if (result.success) {
        console.log(`✅ Order created in ${result.duration.toFixed(2)}ms: ${result.orderId}`);
        resetOrderValues();
        navigate(`/succeeded-order/${result.orderId}`);
        setIsLoading(false);
      } else {
        console.error('❌ Order creation failed:', result.error);
        setError(true);
        setErrorMessage(result.error || 'Error al crear la orden');
        setIsLoading(false);
        window.scrollTo(0, 0);
      }
    } catch (e) {
      setIsLoading(false);
      setError(true);
      setErrorMessage(e.message || 'Error inesperado al crear la orden');
      console.error("❌ Error al crear la orden:", e);
      window.scrollTo(0, 0);
    }
  };

  return (
    <div className="cart-page-container">
      <LoadingComponent isLoading={isLoading || isCreating} />

      <div className="cart-header">
        <h1 className="cart-title">Tu Carrito</h1>
        <p className="cart-subtitle">{cart.length} {cart.length === 1 ? 'producto' : 'productos'} seleccionados</p>
        {isMeli && (
          <div className="cart-meli-badge">
            <span className="cart-meli-logo">meli+</span>
            <span>Precios Mercado Libre</span>
          </div>
        )}
      </div>

      <OrderSummary order={order} cart={cart} />

      <h2 className="cart-section-title">Detalles del pedido</h2>

      {/* Render grouped products */}
      <div className="cart-items-list">
        {Object.values(groupedProducts).map((group) => {
          const isGrouped = group.items.length > 1;
          const overStock = group.totalRequested > group.stock;

          if (!isGrouped) {
            // Single item
            const item = group.items[0];
            const product = item.product || item.item;
            const variants = item.selectedVariants || { size: null, color: null };
            return (
              <div key={`${product.id}-${variants.size}-${variants.color}`}>
                {overStock && (
                  <div className="cart-stock-control cart-stock-control--danger" style={{ marginBottom: 8 }}>
                    <div className="cart-stock-control-row">
                      <span>Pediste:</span>
                      <strong>{group.totalRequested}</strong>
                    </div>
                    <div className="cart-stock-control-row">
                      <span>En stock:</span>
                      <strong>{group.stock}</strong>
                    </div>
                    <div className="cart-stock-control-warning">
                      Estás pidiendo {group.totalRequested - group.stock} más de lo disponible. Ajustá la cantidad.
                    </div>
                  </div>
                )}
                <OrderCard
                  product={product}
                  quantity={item.quantity}
                  selectedVariants={variants}
                  onImageClick={(url) => setSelectedImage(url)}
                  isMeli={isMeli}
                />
              </div>
            );
          }

          // Multiple variants of the same product — group them
          return (
            <div
              key={group.productId}
              className={`cart-stock-group ${overStock ? 'cart-stock-group--danger' : 'cart-stock-group--ok'}`}
            >
              <div className="cart-stock-group-header">
                <span className="cart-stock-group-name">{group.name}</span>
                <span className="cart-stock-group-badge">
                  {group.items.length} variantes
                </span>
              </div>

              {/* Horizontal scroll of variant cards */}
              <div className="cart-stock-group-scroll">
                {group.items.map((item) => {
                  const product = item.product || item.item;
                  const variants = item.selectedVariants || { size: null, color: null };
                  return (
                    <div className="cart-stock-group-card" key={`${product.id}-${variants.size}-${variants.color}`}>
                      <OrderCard
                        product={product}
                        quantity={item.quantity}
                        selectedVariants={variants}
                        onImageClick={(url) => setSelectedImage(url)}
                        isMeli={isMeli}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Stock control bar */}
              <div className={`cart-stock-control ${overStock ? 'cart-stock-control--danger' : 'cart-stock-control--ok'}`}>
                <div className="cart-stock-control-row">
                  <span>Agregados en total:</span>
                  <strong>{group.totalRequested}</strong>
                </div>
                <div className="cart-stock-control-row">
                  <span>En stock:</span>
                  <strong>{group.stock}</strong>
                </div>
                {overStock && (
                  <div className="cart-stock-control-warning">
                    Estás pidiendo {group.totalRequested - group.stock} más de lo disponible. Ajustá las cantidades.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Airbnb Style Sticky Footer */}
      <div className="cart-footer">
        {cart.length >= 1 ? (
          <>
            <div className="cart-total-container">
              <span className="cart-total-label">Total estimado</span>
              <span className="cart-total-amount">{formatPrice(totalPrice)}</span>
            </div>

            <button
              className="cart-checkout-btn"
              onClick={() => handleSubmit()}
              disabled={hasStockConflict}
              title={hasStockConflict ? 'Hay conflictos de stock, ajustá las cantidades' : ''}
            >
              {hasStockConflict ? 'Revisar stock' : 'Finalizar Pedido'}
            </button>
          </>
        ) : (
          <button
            className="cart-back-btn"
            onClick={() => navigate('/select-products')}
          >
            Volver al inventario
          </button>
        )}
      </div>

      {error && (
        <div className="cart-error-overlay">
          <div className="cart-error-content">
            <h1 className="cart-error-title">¡Ups! Algo salió mal</h1>
            <p className="cart-error-message" style={{ whiteSpace: 'pre-line' }}>
              {errorMessage || 'Parece que hubo un problema con el stock o tu pedido. Revisa tu stock actual.'}
            </p>
            <button
              className="cart-error-btn"
              onClick={() => {
                setError(false);
                setErrorMessage('');
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <ImageModal
        isOpen={!!selectedImage}
        imageSrc={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
};

export default Cart;
