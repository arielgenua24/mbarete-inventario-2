import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useFirestoreContext from '../../hooks/useFirestoreContext';
import useHybridOrders from '../../hooks/useHybridOrders';
import useLocalOrders from '../../hooks/useLocalOrders';
import LoadingComponent from '../../components/Loading';
import QRmodal from '../../modals/Qrmodal';
import QRButton from '../../components/QrGenerateBtn';
import ClientShareActions from '../../components/ClientShareActions';
import qrIcon from '../../assets/icons/icons8-qr-100.png';
import { useOrder } from '../../hooks/useOrder';
import OrderSearch from '../../components/OrderSearch';
import {
  getScopeLabel,
  ORDER_SCOPES,
} from '../../utils/orderLocations';
import './styles.css';

const ORDERS_PER_PAGE = 10;

function Orders() {
  const navigate = useNavigate();

  const [isNewData, setIsNewData] = useState(false);
  const [localOrders, setLocalOrders] = useState([]);
  const [firestoreOrders, setFirestoreOrders] = useState([]);
  const [lastVisibleDoc, setLastVisibleDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [QRcode, setQRcode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [openMenuOrderId, setOpenMenuOrderId] = useState(null);
  const [selectedScope, setSelectedScope] = useState(null);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [scopeReady, setScopeReady] = useState(false);
  const [scopeError, setScopeError] = useState('');

  const { deleteOrder, user, isAdminUser, getUserLocation } = useFirestoreContext();
  const { getLocalOrders, getFirestoreOrdersPage } = useHybridOrders();
  const { syncOrder } = useLocalOrders();
  const { setOrdersState } = useOrder();

  const scopeLabel = selectedScope ? getScopeLabel(selectedScope) : '';

  const allLoadedOrders = useMemo(() => [...localOrders, ...firestoreOrders], [localOrders, firestoreOrders]);

  const syncOrdersState = useCallback((orders) => {
    setOrdersState(
      orders.map((order) => ({
        id: order.id,
        state: order.estado || order.status,
      }))
    );
  }, [setOrdersState]);

  useEffect(() => {
    let isMounted = true;

    const resolveViewerScope = async () => {
      if (!user) {
        return;
      }

      setScopeError('');
      setScopeReady(false);
      setSelectedScope(null);
      setLocalOrders([]);
      setFirestoreOrders([]);
      setLastVisibleDoc(null);
      setHasMore(true);

      try {
        const adminViewer = await isAdminUser(user);

        if (!isMounted) {
          return;
        }

        setIsAdminViewer(adminViewer);

        if (adminViewer) {
          setIsScopeModalOpen(true);
          return;
        }

        const userLocation = await getUserLocation(user);

        if (!isMounted) {
          return;
        }

        if (!userLocation) {
          setScopeError('Tu usuario no tiene una sede asignada. Configúralo antes de gestionar pedidos.');
          return;
        }

        setSelectedScope(userLocation);
        setScopeReady(true);
        setIsScopeModalOpen(false);
      } catch (error) {
        console.error('Error resolving order scope:', error);
        if (isMounted) {
          setScopeError('No se pudo resolver la sede de este usuario.');
        }
      }
    };

    resolveViewerScope();

    return () => {
      isMounted = false;
    };
  }, [getUserLocation, isAdminUser, user]);

  const loadInitialOrders = useCallback(async () => {
    if (!scopeReady || !selectedScope) {
      return;
    }

    setIsLoading(true);
    try {
      const [localResult, firestoreResult] = await Promise.all([
        getLocalOrders(selectedScope),
        getFirestoreOrdersPage(ORDERS_PER_PAGE, null, selectedScope)
      ]);

      setLocalOrders(localResult);
      setFirestoreOrders(firestoreResult.orders);
      setLastVisibleDoc(firestoreResult.lastVisibleDoc);
      setHasMore(firestoreResult.hasMore);
      syncOrdersState([...localResult, ...firestoreResult.orders]);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getFirestoreOrdersPage, getLocalOrders, scopeReady, selectedScope, syncOrdersState]);

  const loadMoreOrders = useCallback(async () => {
    if (isLoadingMore || !hasMore || !lastVisibleDoc || !selectedScope) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const result = await getFirestoreOrdersPage(ORDERS_PER_PAGE, lastVisibleDoc, selectedScope);

      setFirestoreOrders((prev) => {
        const mergedOrders = [...prev, ...result.orders];
        syncOrdersState([...localOrders, ...mergedOrders]);
        return mergedOrders;
      });
      setLastVisibleDoc(result.lastVisibleDoc);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Error loading more orders:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [getFirestoreOrdersPage, hasMore, isLoadingMore, lastVisibleDoc, localOrders, selectedScope, syncOrdersState]);

  useEffect(() => {
    loadInitialOrders();
  }, [isNewData, loadInitialOrders]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuOrderId) {
        setOpenMenuOrderId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuOrderId]);

  const handleDelete = async (order) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta orden? El stock de los productos será restaurado.')) {
      setIsLoading(true);
      try {
        const result = await deleteOrder(order.id);
        if (result?.restoredProducts?.length > 0) {
          console.log(`✅ Stock restaurado para ${result.restoredProducts.length} productos`);
        }

        if (order.isLocal) {
          const updatedLocalOrders = localOrders.filter((currentOrder) => currentOrder.id !== order.id);
          setLocalOrders(updatedLocalOrders);
          syncOrdersState([...updatedLocalOrders, ...firestoreOrders]);
        } else {
          const updatedFirestoreOrders = firestoreOrders.filter((currentOrder) => currentOrder.id !== order.id);
          setFirestoreOrders(updatedFirestoreOrders);
          syncOrdersState([...localOrders, ...updatedFirestoreOrders]);
        }
      } catch (error) {
        console.error('Error al eliminar la orden:', error);
        alert('Error al eliminar la orden. Por favor intenta de nuevo.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRetrySync = async (orderId) => {
    setOpenMenuOrderId(null);

    if (window.confirm('¿Reintentar sincronización de esta orden?')) {
      setIsLoading(true);
      const success = await syncOrder(orderId);

      if (success) {
        alert('✅ Orden añadida a la cola de sincronización. Se procesará en breve.');
        setIsNewData((currentValue) => !currentValue);
      } else {
        alert('❌ Error al reintentar sincronización. Por favor intenta de nuevo.');
      }

      setIsLoading(false);
    }
  };

  const handleScopeSelection = (scope) => {
    setSelectedScope(scope);
    setScopeReady(true);
    setIsScopeModalOpen(false);
    setScopeError('');
  };

  const renderOrderCard = (order) => {
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
          <div className="order-card-top-right">
            <span className={`order-location-pill order-location-pill--${order.location}`}>
              {getScopeLabel(order.location)}
            </span>
            <span className={`status-pill ${order.estado === 'listo para despachar' ? 'ready' : 'attention'}`}>
              Estado: {order.estado}
            </span>
          </div>
        </div>

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
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuOrderId(isMenuOpen ? null : (order.id || order.orderId));
                    }}
                  >
                    Opciones <span>⋮</span>
                  </button>

                  {isMenuOpen && (
                    <div className="floating-menu" onClick={(event) => event.stopPropagation()}>
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
  };

  return (
    <div className="orders-container">
      <LoadingComponent isLoading={isLoading} />

      {isScopeModalOpen && isAdminViewer && (
        <div className="scope-modal-overlay">
          <div className="scope-modal-card" onClick={(event) => event.stopPropagation()}>
            <span className="scope-modal-kicker">Pedidos</span>
            <h2 className="scope-modal-title">Cual querido te gustaria ver Majo?</h2>
            <p className="scope-modal-copy">Elegí una sede para ver solo las ventas y los pedidos de esa casa.</p>
            <div className="scope-modal-actions">
              <button
                type="button"
                className="scope-choice scope-choice--local"
                onClick={() => handleScopeSelection(ORDER_SCOPES.LOCAL_AVELLANEDA)}
              >
                <span className="scope-choice-label">Local Avellaneda</span>
                <span className="scope-choice-subtitle">Ventas y pedidos del local</span>
              </button>
              <button
                type="button"
                className="scope-choice scope-choice--central"
                onClick={() => handleScopeSelection(ORDER_SCOPES.CENTRAL)}
              >
                <span className="scope-choice-label">Central</span>
                <span className="scope-choice-subtitle">Ventas y pedidos de la casa central</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="orders-header">
        <div className="orders-title">
          <h1>Órdenes</h1>
          <p>Revisa, comparte y gestiona cada orden en segundos.</p>
          {scopeReady && selectedScope && (
            <div className="orders-scope-banner">
              <span className={`orders-scope-chip orders-scope-chip--${selectedScope}`}>
                Viendo: {scopeLabel}
              </span>
              {isAdminViewer && (
                <button
                  type="button"
                  className="orders-scope-change"
                  onClick={() => setIsScopeModalOpen(true)}
                >
                  Cambiar sede
                </button>
              )}
            </div>
          )}
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

      {scopeError && (
        <div className="orders-access-block">
          <h2>No pudimos abrir Pedidos</h2>
          <p>{scopeError}</p>
        </div>
      )}

      {!scopeError && scopeReady && (
        <>
          <OrderSearch orders={allLoadedOrders} isActionEnabled={true} />

          {allLoadedOrders.length > 0 ? (
            <div className="orders-list">
              {allLoadedOrders.map(renderOrderCard)}
            </div>
          ) : (
            <div className="orders-empty-state">
              <h2>No hay pedidos para {scopeLabel}</h2>
              <p>Cuando entren nuevas ventas en esta sede, aparecerán acá.</p>
            </div>
          )}

          {isLoadingMore && <LoadingComponent isLoading={true} />}
          {!isLoadingMore && hasMore && firestoreOrders.length > 0 && (
            <button onClick={loadMoreOrders} className="load-more-orders-btn">
              Cargar más órdenes
            </button>
          )}
          {!isLoadingMore && !hasMore && firestoreOrders.length > 0 && (
            <p className="no-more-orders-text">
              No hay más órdenes para mostrar
            </p>
          )}
        </>
      )}

      {QRcode && (
        <QRmodal
          QRcode={QRcode}
          setQRcode={setQRcode}
          orderCode={true}
        />
      )}
    </div>
  );
}

export default Orders;
