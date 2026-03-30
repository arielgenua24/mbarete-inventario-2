import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useFirestoreContext from '../../hooks/useFirestoreContext';
import LoadingComponent from '../../components/Loading';
import ImageModal from '../../components/ImageModal';
import {
  getOrderTotalValue,
  getScopeLabel,
  matchesOrderScope,
  ORDER_SCOPES,
} from '../../utils/orderLocations';
import {
  filterOrdersByPeriod,
  formatCurrency,
  getOrderDate,
  groupOrdersByDay,
  REPORT_PERIODS,
  sumOrders,
} from '../../utils/orderReporting';
import './EarningsDetails.css';

const VALID_SCOPES = [ORDER_SCOPES.LOCAL_AVELLANEDA, ORDER_SCOPES.CENTRAL, ORDER_SCOPES.TOTAL];
const VALID_PERIODS = [REPORT_PERIODS.DAILY, REPORT_PERIODS.WEEKLY, REPORT_PERIODS.MONTHLY];

function EarningsDetails() {
  const { period, scope } = useParams();
  const navigate = useNavigate();
  const { filterOrdersByDate, getProductsByOrder } = useFirestoreContext();

  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalImage, setModalImage] = useState(null);

  const activeScope = VALID_SCOPES.includes(scope) ? scope : ORDER_SCOPES.TOTAL;
  const activePeriod = VALID_PERIODS.includes(period) ? period : REPORT_PERIODS.DAILY;
  const scopeLabel = getScopeLabel(activeScope);

  useEffect(() => {
    if (scope !== activeScope || period !== activePeriod) {
      navigate(`/inbox/earnings/${activeScope}/${activePeriod}`, { replace: true });
    }
  }, [activePeriod, activeScope, navigate, period, scope]);

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);

      try {
        const ordersList = await filterOrdersByDate();
        const hydratedOrders = await Promise.all(
          ordersList.map(async (order) => {
            const orderTotal = getOrderTotalValue(order);

            if (orderTotal > 0) {
              return {
                ...order,
                totalAmount: orderTotal,
              };
            }

            const products = await getProductsByOrder(order.id);
            const total = products.reduce((accumulator, item) => {
              const price = Number(item.productData?.price) || 0;
              return accumulator + ((Number(item.stock) || 0) * price);
            }, 0);

            return {
              ...order,
              totalAmount: total,
            };
          })
        );

        setOrders(hydratedOrders);
      } catch (error) {
        console.error('Error fetching earnings detail orders:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [filterOrdersByDate, getProductsByOrder]);

  useEffect(() => {
    setSelectedDay(null);
    setSelectedOrder(null);
  }, [activePeriod, activeScope]);

  const scopedOrders = useMemo(() => (
    orders.filter((order) => matchesOrderScope(order, activeScope))
  ), [activeScope, orders]);

  const filteredOrders = useMemo(() => (
    filterOrdersByPeriod(scopedOrders, activePeriod)
  ), [activePeriod, scopedOrders]);

  const groupedOrders = useMemo(() => {
    if (activePeriod === REPORT_PERIODS.DAILY) {
      return [];
    }

    return groupOrdersByDay(filteredOrders);
  }, [activePeriod, filteredOrders]);

  const periodLabel = activePeriod === REPORT_PERIODS.DAILY
    ? 'Hoy'
    : activePeriod === REPORT_PERIODS.WEEKLY
      ? 'Semana'
      : 'Mes';

  const handleOpenOrder = async (order) => {
    if (order.products?.length) {
      setSelectedOrder({
        ...order,
        products: normalizeProductsForDisplay(order.products),
      });
      return;
    }

    try {
      setIsLoading(true);
      const products = await getProductsByOrder(order.id);
      setSelectedOrder({
        ...order,
        products: normalizeProductsForDisplay(products),
      });
    } catch (error) {
      console.error('Error loading order products:', error);
      alert('No se pudieron cargar los productos de esta venta.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderPeriodSwitcher = () => (
    <div className="earnings-period-switcher">
      {VALID_PERIODS.map((periodOption) => (
        <button
          key={periodOption}
          type="button"
          className={`earnings-period-pill ${periodOption === activePeriod ? 'active' : ''}`}
          onClick={() => navigate(`/inbox/earnings/${activeScope}/${periodOption}`)}
        >
          {periodOption === REPORT_PERIODS.DAILY ? 'Hoy' : periodOption === REPORT_PERIODS.WEEKLY ? 'Semana' : 'Mes'}
        </button>
      ))}
    </div>
  );

  const renderOrderDetail = () => (
    <div className="earnings-detail-view">
      <div className="earnings-header-row">
        <button className="earnings-back-btn" onClick={() => setSelectedOrder(null)}>
          ← Volver
        </button>
        <h2>Detalle de Venta</h2>
      </div>

      <div className="earnings-summary-card">
        <div>
          <span className="earnings-summary-label">Venta</span>
          <strong>{selectedOrder.orderCode || selectedOrder.id}</strong>
        </div>
        <span className={`earnings-scope-pill earnings-scope-pill--${selectedOrder.location}`}>
          {getScopeLabel(selectedOrder.location)}
        </span>
      </div>

      <div className="earnings-total-banner">
        <span>Total de la venta</span>
        <strong>{formatCurrency(selectedOrder.totalAmount)}</strong>
      </div>

      <div className="earnings-info-card">
        <h3>Datos del cliente</h3>
        <div className="earnings-info-row">
          <span>Comprador</span>
          <strong>{selectedOrder.cliente || selectedOrder.customerName || 'N/A'}</strong>
        </div>
        <div className="earnings-info-row">
          <span>Domicilio</span>
          <strong>{selectedOrder.direccion || selectedOrder.address || 'N/A'}</strong>
        </div>
        <div className="earnings-info-row">
          <span>Tel&eacute;fono</span>
          <strong>{selectedOrder.telefono || selectedOrder.phone || 'N/A'}</strong>
        </div>
      </div>

      <div className="earnings-products-card">
        <h3>Productos</h3>
        <div className="earnings-products-list">
          {selectedOrder.products?.map((item, index) => (
            <div key={`${selectedOrder.id}-${index}`} className="earnings-product-item">
              {item.productData?.imageUrl && (
                <img
                  src={item.productData.imageUrl}
                  alt={item.productData.name}
                  className="earnings-product-image"
                  loading="lazy"
                  onClick={(event) => {
                    event.stopPropagation();
                    setModalImage(item.productData.imageUrl);
                  }}
                />
              )}

              <div className="earnings-product-copy">
                <strong>{item.productData?.name || 'Producto'}</strong>
                <span>
                  {(Number(item.stock) || 0)} x {formatCurrency(Number(item.productData?.price) || 0)}
                </span>
              </div>

              <span className="earnings-product-total">
                {formatCurrency((Number(item.stock) || 0) * (Number(item.productData?.price) || 0))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDayDetail = () => (
    <div className="earnings-detail-view">
      <div className="earnings-header-row">
        <button className="earnings-back-btn" onClick={() => setSelectedDay(null)}>
          ← Volver
        </button>
        <h2>{selectedDay.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
      </div>

      {renderPeriodSwitcher()}

      <div className="earnings-total-banner">
        <span>Total del d&iacute;a</span>
        <strong>{formatCurrency(selectedDay.total)}</strong>
      </div>

      <div className="earnings-list-card">
        {selectedDay.orders.map((order) => (
          <button
            key={order.id}
            type="button"
            className="earnings-list-row"
            onClick={() => handleOpenOrder(order)}
          >
            <div className="earnings-list-copy">
              <strong>
                Venta {getOrderDate(order)?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </strong>
              <small>{order.cliente || order.customerName || 'Cliente sin nombre'}</small>
            </div>
            <span>{formatCurrency(order.totalAmount)}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderMainView = () => (
    <div className="earnings-main-view">
      <div className="earnings-header-row">
        <button className="earnings-back-btn" onClick={() => navigate('/inbox')}>
          ← Inbox
        </button>
        <div className="earnings-header-copy">
          <span className="earnings-header-kicker">{scopeLabel}</span>
          <h2>Ventas {scopeLabel}</h2>
        </div>
      </div>

      {renderPeriodSwitcher()}

      <div className="earnings-total-banner">
        <span>{periodLabel} en {scopeLabel}</span>
        <strong>{formatCurrency(sumOrders(filteredOrders))}</strong>
      </div>

      {activePeriod === REPORT_PERIODS.DAILY ? (
        <div className="earnings-list-card">
          {filteredOrders.length > 0 ? filteredOrders.map((order) => (
            <button
              key={order.id}
              type="button"
              className="earnings-list-row"
              onClick={() => handleOpenOrder(order)}
            >
              <div className="earnings-list-copy">
                <strong>
                  Venta {getOrderDate(order)?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </strong>
                <small>{order.cliente || order.customerName || 'Cliente sin nombre'}</small>
              </div>
              <span>{formatCurrency(order.totalAmount)}</span>
            </button>
          )) : (
            <div className="earnings-empty">No hay ventas para esta vista todav&iacute;a.</div>
          )}
        </div>
      ) : (
        <div className="earnings-list-card">
          {groupedOrders.length > 0 ? groupedOrders.map((day) => (
            <button
              key={day.date.toISOString()}
              type="button"
              className="earnings-list-row"
              onClick={() => setSelectedDay(day)}
            >
              <div className="earnings-list-copy">
                <strong>{day.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
                <small>{day.orders.length} ventas</small>
              </div>
              <span>{formatCurrency(day.total)}</span>
            </button>
          )) : (
            <div className="earnings-empty">No hay ventas para esta vista todav&iacute;a.</div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="earnings-shell">
      <LoadingComponent isLoading={isLoading} />

      <div className="earnings-content">
        {selectedOrder && renderOrderDetail()}
        {!selectedOrder && selectedDay && renderDayDetail()}
        {!selectedOrder && !selectedDay && renderMainView()}
      </div>

      <ImageModal
        isOpen={!!modalImage}
        imageSrc={modalImage}
        onClose={() => setModalImage(null)}
      />
    </div>
  );
}

export default EarningsDetails;

function normalizeProductsForDisplay(products = []) {
  return products.map((item, index) => {
    const productData = item.productData || item.productSnapshot || {};
    const quantity = Number(item.stock ?? item.quantity ?? 0);

    return {
      ...item,
      id: item.id || `${item.productId || 'product'}-${index}`,
      productData,
      stock: quantity,
    };
  });
}
