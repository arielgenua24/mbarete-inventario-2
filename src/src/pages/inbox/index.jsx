import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useFirestoreContext from '../../hooks/useFirestoreContext';
import LoadingComponent from '../../components/Loading';
import {
  getScopeLabel,
  getOrderTotalValue,
  matchesOrderScope,
  ORDER_SCOPES,
} from '../../utils/orderLocations';
import {
  filterOrdersByPeriod,
  formatCurrency,
  REPORT_PERIODS,
  sumOrders,
} from '../../utils/orderReporting';
import './styles.css';

const PERIOD_OPTIONS = [
  { id: REPORT_PERIODS.DAILY, label: 'Hoy' },
  { id: REPORT_PERIODS.WEEKLY, label: 'Semana' },
  { id: REPORT_PERIODS.MONTHLY, label: 'Mes' },
];

const CARD_SCOPES = [
  ORDER_SCOPES.LOCAL_AVELLANEDA,
  ORDER_SCOPES.CENTRAL,
  ORDER_SCOPES.TOTAL,
];

function Inbox() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const { filterOrdersByDate, getProductsByOrder } = useFirestoreContext();
  const navigate = useNavigate();

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
        console.error('Error fetching orders for inbox:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [filterOrdersByDate, getProductsByOrder]);

  const scopeCards = useMemo(() => {
    return CARD_SCOPES.map((scope) => {
      const scopedOrders = orders.filter((order) => matchesOrderScope(order, scope));

      return {
        scope,
        label: scope === ORDER_SCOPES.TOTAL ? 'Ventas Total' : `Ventas ${getScopeLabel(scope)}`,
        summary: PERIOD_OPTIONS.map((periodOption) => {
          const periodOrders = filterOrdersByPeriod(scopedOrders, periodOption.id);
          return {
            ...periodOption,
            total: sumOrders(periodOrders),
            count: periodOrders.length,
          };
        }),
      };
    });
  }, [orders]);

  const totalMonthAmount = useMemo(() => {
    const monthlyOrders = filterOrdersByPeriod(orders, REPORT_PERIODS.MONTHLY);
    return sumOrders(monthlyOrders);
  }, [orders]);

  return (
    <div className="inbox-shell">
      <LoadingComponent isLoading={isLoading} />

      <div className="inbox-content">
        <header className="inbox-hero">
          <div>
            <span className="inbox-kicker">Dinero y notificaciones</span>
            <h1>Ingresos divididos por sede</h1>
            <p>Segu&iacute; cada casa por separado y abr&iacute; el desglose del d&iacute;a, la semana o el mes con un toque.</p>
          </div>

          <div className="inbox-hero-total">
            <span className="inbox-hero-label">Total &uacute;ltimos 30 d&iacute;as</span>
            <strong>{formatCurrency(totalMonthAmount)}</strong>
          </div>
        </header>

        <section className="scope-card-grid">
          {scopeCards.map((card) => (
            <article key={card.scope} className={`scope-card scope-card--${card.scope}`}>
              <div className="scope-card-top">
                <div>
                  <span className="scope-card-kicker">{card.scope === ORDER_SCOPES.TOTAL ? 'Combinado' : 'Sede'}</span>
                  <h2>{card.label}</h2>
                </div>
                <span className="scope-card-pill">{getScopeLabel(card.scope)}</span>
              </div>

              <div className="scope-card-body">
                {card.summary.map((period) => (
                  <button
                    key={`${card.scope}-${period.id}`}
                    type="button"
                    className="scope-period-row"
                    onClick={() => navigate(`/inbox/earnings/${card.scope}/${period.id}`)}
                  >
                    <span className="scope-period-copy">
                      <strong>{period.label}</strong>
                      <small>{period.count} ventas</small>
                    </span>
                    <span className="scope-period-amount">{formatCurrency(period.total)}</span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

export default Inbox;
