/**
 * Local Order Verification
 *
 * This component allows verifying products for orders that failed to sync to Firestore.
 * It reads data directly from IndexedDB instead of Firestore.
 * This ensures that even if sync fails, the order can still be processed locally.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useLocalOrders from '../../hooks/useLocalOrders';
import LoadingComponent from '../../components/Loading';
import './styles.css';

const normalizeVariantToken = (value) => {
  if (value === undefined || value === null) return 'na';
  const normalized = String(value).trim().toLowerCase();
  return normalized || 'na';
};

const buildLineItemKey = (product, index) => {
  const productId = String(product?.productId ?? product?.id ?? 'unknown');
  const size = normalizeVariantToken(product?.selectedVariants?.size);
  const color = normalizeVariantToken(product?.selectedVariants?.color);
  return `${productId}__${size}__${color}__${index}`;
};

function LocalOrderVerification() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { getOrderById } = useLocalOrders();

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verifiedCounts, setVerifiedCounts] = useState({});

  useEffect(() => {
    const fetchOrder = async () => {
      setIsLoading(true);
      try {
        console.log('📦 Loading order from IndexedDB:', orderId);
        const orderData = await getOrderById(orderId);

        if (!orderData) {
          setError('Orden no encontrada en la base de datos local');
          return;
        }

        console.log('✅ Order loaded from IndexedDB:', orderData);
        const normalizedProducts = (orderData.products || []).map((product, index) => ({
          ...product,
          lineKey: buildLineItemKey(product, index)
        }));
        setOrder({
          ...orderData,
          products: normalizedProducts
        });

        // Initialize verified counts (all at 0)
        const initialCounts = {};
        normalizedProducts.forEach(product => {
          initialCounts[product.lineKey] = 0;
        });
        setVerifiedCounts(initialCounts);
      } catch (err) {
        console.error('❌ Error loading order:', err);
        setError('Error al cargar la orden: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, getOrderById]);

  const handleVerifiedChange = (lineKey, value) => {
    setVerifiedCounts(prev => ({
      ...prev,
      [lineKey]: parseInt(value) || 0
    }));
  };

  const handleIncrement = (lineKey, maxQuantity) => {
    setVerifiedCounts(prev => ({
      ...prev,
      [lineKey]: Math.min((prev[lineKey] || 0) + 1, maxQuantity)
    }));
  };

  const handleDecrement = (lineKey) => {
    setVerifiedCounts(prev => ({
      ...prev,
      [lineKey]: Math.max((prev[lineKey] || 0) - 1, 0)
    }));
  };

  const isFullyVerified = () => {
    if (!order) return false;
    return order.products.every(product =>
      verifiedCounts[product.lineKey] === product.quantity
    );
  };

  const handleComplete = () => {
    if (isFullyVerified()) {
      alert('✅ Todos los productos han sido verificados localmente!');
      navigate('/orders');
    } else {
      alert('⚠️ Aún hay productos sin verificar completamente');
    }
  };

  if (isLoading) {
    return <LoadingComponent isLoading={true} />;
  }

  if (error) {
    return (
      <div className="local-verification-container">
        <div style={{
          backgroundColor: '#f8d7da',
          border: '1px solid #dc3545',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h2>❌ Error</h2>
          <p>{error}</p>
          <button
            onClick={() => navigate('/orders')}
            style={{
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '10px 20px',
              marginTop: '10px',
              cursor: 'pointer'
            }}
          >
            Volver a Órdenes
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="local-verification-container">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>No se encontró la orden</p>
          <button onClick={() => navigate('/orders')}>Volver a Órdenes</button>
        </div>
      </div>
    );
  }

  return (
    <div className="local-verification-container">
      <div className="verification-header">
        <button
          onClick={() => navigate('/orders')}
          style={{
            backgroundColor: '#6c757d',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: 'pointer',
            marginBottom: '10px'
          }}
        >
          ← Volver
        </button>

        <h1>📦 Verificación Local de Productos</h1>

        {/* Warning banner */}
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px'
        }}>
          <strong>⚠️ Modo Local:</strong> Esta orden no se ha sincronizado con Firestore.
          Los datos se están leyendo desde la base de datos local del dispositivo.
        </div>

        <div className="order-info-card">
          <h3>Información de la Orden</h3>
          <p><strong>Código:</strong> {order.orderCode}</p>
          <p><strong>Cliente:</strong> {order.customerName}</p>
          <p><strong>Teléfono:</strong> {order.phone}</p>
          <p><strong>Dirección:</strong> {order.address}</p>
          <p><strong>Total:</strong> ${order.totalAmount}</p>
          <p><strong>Estado de Sync:</strong>
            <span style={{
              marginLeft: '8px',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: order.syncStatus === 'failed' ? '#f8d7da' : '#fff3cd',
              color: order.syncStatus === 'failed' ? '#721c24' : '#856404'
            }}>
              {order.syncStatus === 'failed' ? '❌ Falló' : '⏳ Pendiente'}
            </span>
          </p>
          {order.lastError && (
            <p style={{ color: '#dc3545', fontSize: '14px', marginTop: '8px' }}>
              <strong>Error:</strong> {order.lastError}
            </p>
          )}
        </div>
      </div>

      <div className="products-verification-section">
        <h2>Productos a Verificar</h2>
        <div className="products-list">
          {order.products.map((product) => {
            const verified = verifiedCounts[product.lineKey] || 0;
            const total = product.quantity;
            const isComplete = verified === total;

            return (
              <div
                key={product.lineKey}
                className="product-verification-card"
                style={{
                  border: isComplete ? '2px solid #28a745' : '2px solid #ddd',
                  backgroundColor: isComplete ? '#d4edda' : '#fff'
                }}
              >
                {product.productSnapshot.imageUrl && (
                  <img
                    src={product.productSnapshot.imageUrl}
                    alt={product.productSnapshot.name}
                    className="product-image"
                  />
                )}

                <div className="product-details">
                  <h3>{product.productSnapshot.name}</h3>
                  <p><strong>Código:</strong> {product.productSnapshot.productCode}</p>
                  <p><strong>Precio:</strong> ${product.productSnapshot.price}</p>
                  <p><strong>Cantidad solicitada:</strong> {product.quantity}</p>

                  {product.selectedVariants && (product.selectedVariants.size || product.selectedVariants.color) && (
                    <div className="variants">
                      {product.selectedVariants.size && (
                        <span className="variant-badge">Talla: {product.selectedVariants.size}</span>
                      )}
                      {product.selectedVariants.color && (
                        <span className="variant-badge">Color: {product.selectedVariants.color}</span>
                      )}
                    </div>
                  )}

                  <div className="verification-controls">
                    <label>Verificados:</label>
                    <div className="counter-controls">
                      <button
                        onClick={() => handleDecrement(product.lineKey)}
                        disabled={verified <= 0}
                        className="counter-btn"
                      >
                        -
                      </button>

                      <input
                        type="number"
                        min="0"
                        max={total}
                        value={verified}
                        onChange={(e) => handleVerifiedChange(product.lineKey, e.target.value)}
                        className="verified-input"
                      />

                      <button
                        onClick={() => handleIncrement(product.lineKey, total)}
                        disabled={verified >= total}
                        className="counter-btn"
                      >
                        +
                      </button>
                    </div>

                    <div className="progress-indicator">
                      <span style={{
                        color: isComplete ? '#28a745' : '#856404',
                        fontWeight: 'bold'
                      }}>
                        {verified} / {total} {isComplete && '✅'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="verification-footer">
        <div className="summary">
          <h3>Resumen de Verificación</h3>
          <p>
            Productos completamente verificados: {
              order.products.filter(p =>
                verifiedCounts[p.lineKey] === p.quantity
              ).length
            } / {order.products.length}
          </p>
        </div>

        <button
          onClick={handleComplete}
          disabled={!isFullyVerified()}
          style={{
            backgroundColor: isFullyVerified() ? '#28a745' : '#6c757d',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '12px 30px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: isFullyVerified() ? 'pointer' : 'not-allowed',
            opacity: isFullyVerified() ? 1 : 0.6
          }}
        >
          {isFullyVerified() ? '✅ Completar Verificación' : '⏳ Verificar Todos los Productos'}
        </button>
      </div>
    </div>
  );
}

export default LocalOrderVerification;
