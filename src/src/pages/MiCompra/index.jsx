import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseSetUp';
import ImageModal from '../../components/ImageModal';
import './styles.css';

/**
 * Página PÚBLICA - No requiere autenticación
 * El cliente escanea el QR y ve su compra
 */
function MiCompra() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const isMeli = searchParams.get('isMeli') === 'true';
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  // Lead capture modal state
  const leadKey = `lead-submitted-${orderId}`;
  const [leadSubmitted, setLeadSubmitted] = useState(() => !!localStorage.getItem(leadKey));
  const [modalOpen, setModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', whatsapp: '', talle: '' });
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadDone, setLeadDone] = useState(false);

  // Cycling product showcase
  const SHOWCASE_PRODUCTS = [
    { img: 'https://ik.imagekit.io/arielgenua/products/WhatsApp_Image_2026-03-14_at_10.14.21_rLzuOh5x3.jpeg', price: '$15.000' },
    { img: 'https://ik.imagekit.io/arielgenua/products/WhatsApp_Image_2026-03-14_at_10.47.36_zGoYHOfM_.jpeg', price: '$21.000' },
    { img: 'https://ik.imagekit.io/arielgenua/products/pantalon_negro_ara%C3%B1a_1_gfs8l_E2H.jpeg',            price: '$23.000' },
    { img: 'https://ik.imagekit.io/arielgenua/products/WhatsApp_Image_2026-03-14_at_10.53.04_r3Rqgy35A.jpeg', price: '$20.000' },
  ];
  const [showcaseIdx, setShowcaseIdx] = useState(0);

  useEffect(() => {
    if (!modalOpen) return;
    const interval = setInterval(() => {
      setShowcaseIdx(i => (i + 1) % SHOWCASE_PRODUCTS.length);
    }, 800);
    return () => clearInterval(interval);
  }, [modalOpen]);

  // Auto-open modal shortly after page loads (only if not already submitted)
  useEffect(() => {
    if (leadSubmitted) return;
    const timer = setTimeout(() => setModalOpen(true), 800);
    return () => clearTimeout(timer);
  }, [leadSubmitted]);

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

          const customerName = data.customerName || data.cliente;

          // Solo exponer datos que el cliente debe ver
          setOrder({
            orderCode: data.orderCode || orderId.slice(-8).toUpperCase(),
            customerName,
            fecha: data.fecha || formatDate(data.createdAt),
            products,
            totalAmount: data.totalAmount || calculateTotal(products),
            status: data.status || data.estado || 'pendiente'
          });

          // Pre-fill name if we have a real one
          if (customerName && customerName !== 'Cliente sin nombre') {
            setLeadForm(f => ({ ...f, name: customerName }));
          }
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

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    if (!leadForm.whatsapp.trim() || !leadForm.talle) return;

    setLeadSubmitting(true);
    try {
      await setDoc(doc(db, 'leads', orderId), {
        name: leadForm.name.trim() || null,
        whatsapp: leadForm.whatsapp.trim(),
        talle: leadForm.talle,
        orderId,
        source: isMeli ? 'meli' : 'direct',
        createdAt: serverTimestamp(),
      });
      localStorage.setItem(leadKey, '1');
      setLeadDone(true);
      setTimeout(() => {
        setLeadSubmitted(true);
        setModalOpen(false);
      }, 2200);
    } catch (err) {
      console.error('Error saving lead:', err);
    } finally {
      setLeadSubmitting(false);
    }
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

      {/* Banner Meli → Tienda propia */}
      {isMeli && (
        <div className="meli-promo-banner">
          <div className="meli-promo-inner">
            <div className="meli-promo-badge">50% OFF</div>
            <h2 className="meli-promo-title">
              En tu próxima compra, conseguí jeans a 50% OFF en nuestra tienda.
            </h2>
            <a
              href="https://mbarete.store/#/home"
              className="meli-promo-cta"
            >
              Ver la tienda →
            </a>
          </div>
        </div>
      )}

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

      {/* Lead capture modal */}
      {modalOpen && (
        <div className="lead-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="lead-modal" onClick={e => e.stopPropagation()}>
            <button className="lead-modal-close" onClick={() => setModalOpen(false)}>×</button>

            {leadDone ? (
              <div className="lead-modal-success">
                <div className="lead-modal-success-icon">🎉</div>
                <h2 className="lead-modal-title">¡Ya sos parte del club!</h2>
                <p className="lead-modal-sub">
                  Te avisamos por WhatsApp cuando haya descuentos en tu talle.
                </p>
              </div>
            ) : (
              <>
                {/* Product showcase strip */}
                <div className="lead-modal-showcase">
                  {SHOWCASE_PRODUCTS.map((p, i) => (
                    <img
                      key={p.img}
                      src={p.img}
                      alt="producto"
                      className={`lead-modal-showcase-img ${i === showcaseIdx ? 'active' : ''}`}
                    />
                  ))}
                  <div className="lead-modal-showcase-price">
                    {SHOWCASE_PRODUCTS[showcaseIdx].price}
                    <span className="lead-modal-showcase-off"> · 50% OFF comprando directo</span>
                  </div>
                  <div className="lead-modal-showcase-dots">
                    {SHOWCASE_PRODUCTS.map((_, i) => (
                      <span key={i} className={`lead-modal-dot ${i === showcaseIdx ? 'active' : ''}`} />
                    ))}
                  </div>
                </div>

                <div className="lead-modal-body">
                <h2 className="lead-modal-title">Bienvenido a Mbarete</h2>
                <p className="lead-modal-sub">
                  Completá tus datos y accedé a un 50% OFF en tu próxima compra.
                </p>

                <form className="lead-modal-form" onSubmit={handleLeadSubmit}>
                  <input
                    className="lead-modal-input"
                    type="text"
                    placeholder="Tu nombre"
                    value={leadForm.name}
                    onChange={e => setLeadForm(f => ({ ...f, name: e.target.value }))}
                  />
                  <input
                    className="lead-modal-input"
                    type="tel"
                    placeholder="Tu WhatsApp (ej: 11 1234-5678)"
                    value={leadForm.whatsapp}
                    onChange={e => setLeadForm(f => ({ ...f, whatsapp: e.target.value }))}
                    required
                  />

                  <div className="lead-modal-talle-label">Tu talle de jean</div>
                  <div className="lead-modal-talle-grid">
                    {['28', '30', '32', '34', '36', '38', '40', '42+'].map(t => (
                      <button
                        key={t}
                        type="button"
                        className={`lead-modal-talle-btn ${leadForm.talle === t ? 'selected' : ''}`}
                        onClick={() => setLeadForm(f => ({ ...f, talle: t }))}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="lead-modal-submit"
                    disabled={leadSubmitting || !leadForm.whatsapp.trim() || !leadForm.talle}
                  >
                    {leadSubmitting ? 'Guardando...' : 'Quiero mi 50% OFF'}
                  </button>

                  <button
                    type="button"
                    className="lead-modal-skip"
                    onClick={() => setModalOpen(false)}
                  >
                    Ahora no
                  </button>
                </form>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
