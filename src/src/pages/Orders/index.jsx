import useFirestoreContext from '../../hooks/useFirestoreContext'
import useHybridOrders from '../../hooks/useHybridOrders'
import useLocalOrders from '../../hooks/useLocalOrders'
import LoadingComponent from '../../components/Loading'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom';
import QRmodal from '../../modals/Qrmodal';
import QRButton from '../../components/QrGenerateBtn';
import ClientShareActions from '../../components/ClientShareActions';
import qrIcon from '../../assets/icons/icons8-qr-100.png';
import { useOrder } from '../../hooks/useOrder';
import OrderSearch from '../../components/OrderSearch';
import './styles.css'

function Orders() {
  const navigate = useNavigate();

  const [isNewData, setIsNewData] = useState(false)
  const [orders, setOrders] = useState([])
  const [QRcode, setQRcode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [openMenuOrderId, setOpenMenuOrderId] = useState(null); // Track which order's menu is open

  const { deleteOrder } = useFirestoreContext()
  const { getAllOrders } = useHybridOrders()
  const { syncOrder } = useLocalOrders()

  const { setOrdersState } = useOrder();

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true)
      // Get orders from both IndexedDB and Firestore
      const allOrders = await getAllOrders()
      setOrders(allOrders)
      setOrdersState((prevState) => [
        ...prevState,
        ...allOrders.map((order) => ({ id: order.id, state: order.estado || order.status }))
      ]);

      setIsLoading(false)
    }
    fetchOrders()

  }, [getAllOrders, isNewData])

  console.log('📊 All orders (local + Firestore):', orders)

  const handleDelete = async (order) => {

    if (window.confirm('¿Estás seguro de que deseas eliminar este producto?')) {
      setIsLoading(true)
      setIsNewData(!isNewData)
      await deleteOrder(order.id);
      setIsLoading(false)
    }

  }

  const handleRetrySync = async (orderId) => {
    setOpenMenuOrderId(null); // Close menu
    if (window.confirm('¿Reintentar sincronización de esta orden?')) {
      setIsLoading(true)
      const success = await syncOrder(orderId)
      if (success) {
        alert('✅ Orden añadida a la cola de sincronización. Se procesará en breve.')
        setIsNewData(!isNewData) // Refresh orders list
      } else {
        alert('❌ Error al reintentar sincronización. Por favor intenta de nuevo.')
      }
      setIsLoading(false)
    }
  }

  const toggleMenu = (orderId) => {
    setOpenMenuOrderId(openMenuOrderId === orderId ? null : orderId);
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuOrderId) {
        setOpenMenuOrderId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuOrderId]);

  return (
    <div className="orders-container">
       <LoadingComponent isLoading={isLoading} />
      <div className="orders-header">
        <div className="orders-title">
          <h1>Órdenes</h1>
          <p>Revisa, comparte y gestiona cada orden en segundos.</p>
        </div>
        <button
          className="qr-search-btn"
          onClick={() => {
            navigate('/qrsearch?redirect=order-data');
          }}
        >
          Buscar por QR
          <img src={qrIcon} alt="Qr icon" />
        </button>
      </div>

      <OrderSearch orders={orders} isActionEnabled={true}/>
         

      <div className="orders-list">
      {orders.map((order) => {
        const isNotSynced = order.syncStatus === 'pending' || order.syncStatus === 'syncing' || order.syncStatus === 'failed';
        const isMenuOpen = openMenuOrderId === (order.id || order.orderId);

        return (
          <div key={order.id} className="order-card">
            <div className="order-card-top">
              <div className="order-identity">
                <span className="order-label">Orden</span>
                <h3 className="order-code">#{order.orderCode}</h3>
                <span className="order-date">Fecha: {order.fecha}</span>
              </div>
              <span className={`status-pill ${order.estado === 'listo para despachar' ? 'ready' : 'attention'}`}>
                Estado: {order.estado}
              </span>
            </div>

            {/* Sync Status Indicator */}
            {order.syncStatus === 'pending' && (
              <div className="sync-banner sync-banner--pending">
                <div className="sync-banner-left">
                  <span className="sync-dot"></span>
                  <span>Pendiente de sincronización</span>
                </div>
                <span className="sync-hint">Usa Opciones para reintentar</span>
              </div>
            )}

            {order.syncStatus === 'syncing' && (
              <div className="sync-banner sync-banner--syncing">
                <span className="sync-spinner"></span>
                <span>Sincronizando</span>
              </div>
            )}

            {/* Failed sync status - Only show error and local verification */}
            {order.syncStatus === 'failed' && (
              <div className="sync-banner sync-banner--failed">
                <div className="sync-banner-left">
                  <span className="sync-dot sync-dot--danger"></span>
                  <span>Error en la sincronización</span>
                </div>
                {order.lastError && (
                  <div className="sync-error">
                    Error: {order.lastError}
                  </div>
                )}
                <div className="sync-actions">
                  <button
                    className="primary-btn"
                    onClick={() => navigate(`/local-order-verification/${order.id || order.orderId}`)}
                  >
                    Verificar productos (local)
                  </button>
                </div>
              </div>
            )}

            <div className="order-details">
              <div className="order-detail">
                <span className="detail-label">Cliente</span>
                <span className="detail-value">{order.cliente}</span>
              </div>
              <div className="order-detail">
                <span className="detail-label">Dirección</span>
                <span className="detail-value">{order.direccion}</span>
              </div>
              <div className="order-detail">
                <span className="detail-label">Teléfono</span>
                <span className="detail-value">{order.telefono}</span>
              </div>
            </div>

            <div className="order-actions">
              <div className="order-actions-row">
                <span className="actions-label">Compartir con cliente</span>
                <div className="share-buttons-container">
                  <ClientShareActions order={order} variant="compact" />
                </div>
              </div>

              <div className="order-actions-row">
                <span className="actions-label">Acciones de orden</span>
                <div className="order-actions-right">
                  {!isNotSynced && (
                    <QRButton
                      product={order}
                      onQRGenerate={setQRcode}
                    />
                  )}

                  {isNotSynced && (
                    <div className="menu-wrapper">
                      <button
                        className="menu-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMenu(order.id || order.orderId);
                        }}
                      >
                        Opciones <span>⋮</span>
                      </button>

                      {isMenuOpen && (
                        <div className="floating-menu" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="menu-item"
                            onClick={() => handleRetrySync(order.id || order.orderId)}
                          >
                            Reintentar sincronización
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(order)}
                  >
                    Eliminar orden
                  </button>
                </div>
              </div>

              {order.syncStatus !== 'failed' && (
                <button
                  className="verify-button"
                  onClick={() => navigate(`/ProductsVerification/${order.id}/?orderEstado=${order.estado}`)}
                  disabled={order.syncStatus === 'pending' || order.syncStatus === 'syncing'}
                  title={
                    order.syncStatus === 'pending'
                      ? 'Esperando sincronización con Firestore'
                      : order.syncStatus === 'syncing'
                      ? 'Sincronizando'
                      : ''
                  }
                >
                  {order.syncStatus === 'pending' || order.syncStatus === 'syncing'
                    ? 'Sincronizando productos'
                    : 'Verificar productos'}
                </button>
              )}
            </div>
          </div>
        );
      })}
      </div>

  {QRcode && (
          <QRmodal 
          QRcode={QRcode}
          setQRcode={setQRcode}
          orderCode={true}
          />
      )}
    </div>
  )
}

export default Orders
