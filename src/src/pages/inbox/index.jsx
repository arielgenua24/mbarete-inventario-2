import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useFirestoreContext from '../../hooks/useFirestoreContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import LoadingComponent from '../../components/Loading';
import {
  getScopeLabel,
  matchesOrderScope,
  ORDER_SCOPES,
} from '../../utils/orderLocations';
import {
  formatCurrency,
  REPORT_PERIODS,
  sumOrders,
} from '../../utils/orderReporting';
import './styles.css';

const PERIOD_OPTIONS = [
  { id: REPORT_PERIODS.DAILY,   label: 'Hoy' },
  { id: REPORT_PERIODS.WEEKLY,  label: 'Semana' },
  { id: REPORT_PERIODS.MONTHLY, label: 'Mes' },
];

const ADMIN_CARD_SCOPES = [
  ORDER_SCOPES.LOCAL_AVELLANEDA,
  ORDER_SCOPES.CENTRAL,
  ORDER_SCOPES.TOTAL,
];

function Inbox() {
  const { getOrdersForInboxPeriod, getUserLocation, user } = useFirestoreContext();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  const [selectedPeriod, setSelectedPeriod] = useState(REPORT_PERIODS.DAILY);
  const [periodCache, setPeriodCache] = useState({
    [REPORT_PERIODS.DAILY]:   null,
    [REPORT_PERIODS.WEEKLY]:  null,
    [REPORT_PERIODS.MONTHLY]: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [employeeScope, setEmployeeScope] = useState(null);

  // Resolve the employee's assigned location once we know they're not admin.
  useEffect(() => {
    if (isAdmin === false && user) {
      getUserLocation(user).then(setEmployeeScope);
    }
  }, [isAdmin, user, getUserLocation]);

  // Admin sees all 3 scopes and all period tabs.
  // Employee sees only their assigned location, locked to daily.
  const cardScopes = isAdmin ? ADMIN_CARD_SCOPES : (employeeScope ? [employeeScope] : []);
  const activePeriod = isAdmin ? selectedPeriod : REPORT_PERIODS.DAILY;

  const fetchPeriod = useCallback(async (period) => {
    setIsLoading(true);
    try {
      const orders = await getOrdersForInboxPeriod(period);
      setPeriodCache((prev) => ({ ...prev, [period]: orders }));
    } catch (error) {
      console.error('Error fetching inbox period:', error);
      setPeriodCache((prev) => ({ ...prev, [period]: [] }));
    } finally {
      setIsLoading(false);
    }
  }, [getOrdersForInboxPeriod]);

  useEffect(() => {
    if (periodCache[activePeriod] === null) {
      fetchPeriod(activePeriod);
    }
  }, [activePeriod, periodCache, fetchPeriod]);

  const activeOrders = periodCache[activePeriod] ?? [];

  const scopeCards = useMemo(() => {
    return cardScopes.map((scope) => {
      const scopedOrders = activeOrders.filter((o) => matchesOrderScope(o, scope));
      return {
        scope,
        label: scope === ORDER_SCOPES.TOTAL
          ? 'Ventas Total'
          : `Ventas ${getScopeLabel(scope)}`,
        total: sumOrders(scopedOrders),
        count: scopedOrders.length,
      };
    });
  }, [cardScopes, activeOrders]);

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
        </header>

        {isAdmin && (
          <div className="inbox-period-tabs" role="tablist" aria-label="Período">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={selectedPeriod === opt.id}
                className={`inbox-period-tab${selectedPeriod === opt.id ? ' inbox-period-tab--active' : ''}`}
                onClick={() => setSelectedPeriod(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

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
                <button
                  type="button"
                  className="scope-period-row"
                  onClick={() => navigate(`/inbox/earnings/${card.scope}/${activePeriod}`)}
                >
                  <span className="scope-period-copy">
                    <strong>{PERIOD_OPTIONS.find((o) => o.id === activePeriod)?.label}</strong>
                    <small>
                      {isLoading && periodCache[activePeriod] === null
                        ? 'Cargando\u2026'
                        : `${card.count} ventas`}
                    </small>
                  </span>
                  <span className="scope-period-amount">{formatCurrency(card.total)}</span>
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

export default Inbox;
