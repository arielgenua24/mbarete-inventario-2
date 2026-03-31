import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseSetUp';
import ImageModal from '../../components/ImageModal';
import './styles.css';

/**
 * Página PÚBLICA - No requiere autenticación
 * El cliente escanea el QR y ve su compra
 */
function MiCompra() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        // Buscar en Firestore (órdenes sincronizadas)
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);

        if (orderSnap.exists()) {
          const data = orderSnap.data();

          // Products may be embedded in the order doc (new format) or in a subcollection (old format)
          let products = data.products || [];
          if (products.length === 0) {
            const productsSnap = await getDocs(collection(db, 'orders', orderId, 'products'));
            products = productsSnap.docs.map(d => {
              const pData = d.data();
              return {
                productSnapshot: pData.productSnapshot,
                selectedVariants: pData.selectedVariants,
                quantity: pData.stock, // subcollection uses 'stock' for quantity ordered
              };
            });
          }

          // Solo exponer datos que el cliente debe ver
          setOrder({
            orderCode: data.orderCode || orderId.slice(-8).toUpperCase(),
            customerName: data.customerName || data.cliente,
            fecha: data.fecha || formatDate(data.createdAt),
            products,
            totalAmount: data.totalAmount || calculateTotal(products),
            status: data.status || data.estado || 'pendiente'
          });
        } else {
          setError('Orden no encontrada');
        }
      } catch (err) {
        console.error('Error fetching order:', err);
        setError('Error al cargar la orden');
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  // Función auxiliar para formatear fecha
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Fecha no disponible';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Función auxiliar para calcular total
  const calculateTotal = (products) => {
    if (!products || !Array.isArray(products)) return 0;
    return products.reduce((sum, p) => {
      const price = p.productSnapshot?.price || p.price || 0;
      const qty = p.quantity || p.stock || 1;
      return sum + (price * qty);
    }, 0);
  };

  // Formatear precio
  const formatPrice = (price) => {
    return Number(price).toLocaleString('es-AR');
  };

  if (loading) {
    return (
      <div className="mi-compra-container">
        <div className="mi-compra-loading">
          <div className="loading-spinner"></div>
          <p>Cargando tu compra...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mi-compra-container">
        <div className="mi-compra-error">
          <div className="error-icon">!</div>
          <h2>No pudimos encontrar tu compra</h2>
          <p>{error}</p>
          <p className="error-hint">Si crees que es un error, contacta con la tienda.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mi-compra-container">
      {/* Header con branding */}
      <header className="mi-compra-header">
        <div className="brand-logo">
          <h1>Mbarete</h1>
        </div>
        <p className="header-subtitle">Detalle de tu compra</p>
      </header>

      {/* Card principal */}
      <main className="mi-compra-content">
        {/* Info del pedido */}
        <div className="order-info-card">
          <div className="order-code-section">
            <span className="label">Código de pedido</span>
            <span className="order-code">{order.orderCode}</span>
          </div>

          <div className="order-meta">
            <div className="meta-item">
              <span className="meta-icon">📅</span>
              <span>{order.fecha}</span>
            </div>
            <div className="meta-item">
              <span className="meta-icon">👤</span>
              <span>{order.customerName}</span>
            </div>
          </div>

        </div>

        {/* Lista de productos */}
        <div className="products-section">
          <h2 className="section-title">Productos</h2>

          <div className="products-list">
            {order.products && order.products.map((product, index) => {
              const name = product.productSnapshot?.name || product.name || 'Producto';
              const price = product.productSnapshot?.price || product.price || 0;
              const quantity = product.quantity || product.stock || 1;
              const variants = product.selectedVariants || {};
              const imageUrl = product.productSnapshot?.imageUrl || product.imageUrl || null;
              const subtotal = price * quantity;

              return (
                <div key={index} className="product-card">
                  {/* Header: Imagen + Info básica */}
                  <div className="product-header">
                    <div
                    className={`product-image-container ${imageUrl ? 'clickable' : ''}`}
                    onClick={() => imageUrl && setSelectedImage({ src: imageUrl, alt: name })}
                  >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={name}
                          className="product-image"
                          loading="lazy"
                        />
                      ) : (
                        <div className="product-image-placeholder">
                          <span>📦</span>
                        </div>
                      )}
                      {imageUrl && <div className="zoom-hint">🔍</div>}
                    </div>

                    <div className="product-info">
                      <h3 className="product-name">{name}</h3>
                      {(variants.color || variants.size) && (
                        <p className="product-variants">
                          {variants.size && <span>{variants.size}</span>}
                          {variants.color && variants.size && ' · '}
                          {variants.color && <span>{variants.color}</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Desglose de precio */}
                  <div className="product-pricing">
                    <div className="price-row">
                      <span className="price-label">Precio por unidad</span>
                      <span className="price-value">${formatPrice(price)}</span>
                    </div>
                    <div className="price-row">
                      <span className="price-label">Cantidad</span>
                      <span className="price-value quantity-badge">×{quantity}</span>
                    </div>
                    <div className="price-row subtotal-row">
                      <span className="price-label">Subtotal</span>
                      <span className="price-value subtotal-value">${formatPrice(subtotal)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Total */}
        <div className="total-section">
          <span className="total-label">Total</span>
          <span className="total-amount">${formatPrice(order.totalAmount)}</span>
        </div>

        {/* Footer mensaje */}
        <div className="thank-you-section">
          <p>¡Gracias por tu compra!</p>
          <p className="small-text">Mbarete; jeans mayorista de alta costura</p>
        </div>
      </main>

      {/* Modal para ver imagen en grande */}
      <ImageModal
        isOpen={!!selectedImage}
        imageSrc={selectedImage?.src}
        altText={selectedImage?.alt}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
}

export default MiCompra;
