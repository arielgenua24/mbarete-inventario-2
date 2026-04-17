import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getMonthWeeks, getMonthNameEs } from '../../utils/dateUtils';
import kellyAudio from '../../assets/sounds/kelly.mp3';
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

  // ── SP-Section: cuántas prendas has vendido ──
  const now = useMemo(() => new Date(), []);
  const weeks = useMemo(() => getMonthWeeks(now), [now]);
  const monthName = useMemo(() => getMonthNameEs(now), [now]);
  const currentWeek = useMemo(() => weeks.find(w => w.isCurrent), [weeks]);
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  const audioRef = useRef(null);
  const playAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(kellyAudio);
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  const [selectedPeriod, setSelectedPeriod] = useState(REPORT_PERIODS.DAILY);
  const [chartScope, setChartScope] = useState(ORDER_SCOPES.LOCAL_AVELLANEDA);
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

  const CHART_SCOPES = [
    { id: ORDER_SCOPES.LOCAL_AVELLANEDA, label: 'Avellaneda' },
    { id: ORDER_SCOPES.CENTRAL,          label: 'Mercado Libre' },
    { id: ORDER_SCOPES.TOTAL,            label: 'Total' },
  ];

  const topProducts = useMemo(() => {
    const scopedOrders = activeOrders.filter(o => matchesOrderScope(o, chartScope));
    const productMap = {};
    scopedOrders.forEach(order => {
      (order.products || []).forEach(item => {
        const name = item.productSnapshot?.name;
        if (!name) return;
        const qty = item.quantity || item.stock || 1;
        productMap[name] = (productMap[name] || 0) + qty;
      });
    });
    return Object.entries(productMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 7)
      .map(([name, count]) => ({ name, count }));
  }, [activeOrders, chartScope]);

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

        {/* ── Más vendidos chart ── */}
        <section className={`top-products-section${chartScope === ORDER_SCOPES.CENTRAL ? ' top-products-section--meli' : ''}`}>
          <header className="top-products-header">
            <h2 className="top-products-title">Más vendidos</h2>
            <span className="top-products-period-badge">
              {PERIOD_OPTIONS.find(o => o.id === activePeriod)?.label}
            </span>
          </header>

          <div className="top-products-tabs" role="tablist" aria-label="Sede">
            {CHART_SCOPES.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={chartScope === tab.id}
                className={`top-products-tab${chartScope === tab.id ? ' top-products-tab--active' : ''}`}
                onClick={() => setChartScope(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {topProducts.length === 0 ? (
            <div className="top-products-empty">Sin ventas registradas para este período</div>
          ) : (
            <div className="top-products-chart">
              {topProducts.map((item, i) => {
                const pct = Math.round((item.count / topProducts[0].count) * 100);
                return (
                  <div key={item.name} className="top-products-row">
                    <span className="top-products-rank">#{i + 1}</span>
                    <div className="top-products-bar-area">
                      <div className="top-products-bar-label">{item.name}</div>
                      <div className="top-products-bar-track">
                        <div className="top-products-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="top-products-count">{item.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Cuántas prendas has vendido ── */}
        <section className="sp-section">

          <header className="sp-section-header">
            <div className="sp-logo-circle" onClick={playAudio} role="button" tabIndex={0}>
              <img
                src="https://ik.imagekit.io/arielgenua/ChatGPT%20Image%206%20abr%202026,%2005_54_51%20p.m..png"
                alt="Mbarete Inventory"
              />
            </div>
            <h2 className="sp-section-title">Cuántas prendas has vendido<span className="sp-title-accent">?</span></h2>
          </header>

          {/* Recientes */}
          <div className="sp-group">
            <p className="sp-group-label">Recientes</p>
            <div className="sp-recientes-row">
              <button
                className="sp-card sp-card-reciente sp-card--active"
                onClick={() => navigate('/selled-products/today')}
              >
                <span className="sp-card-eyebrow">HOY</span>
                <span className="sp-card-main">{dd}/{mm}</span>
              </button>
              <button
                className="sp-card sp-card-reciente sp-card--active"
                onClick={() => navigate(`/selled-products/week-${currentWeek?.weekNum ?? 1}`)}
              >
                <span className="sp-card-eyebrow">Esta semana</span>
                <span className="sp-card-main">{monthName}</span>
              </button>
            </div>
          </div>

          {/* Semanas */}
          <div className="sp-group">
            <p className="sp-group-label">Semanas</p>
            <div className="sp-weeks-scroll">
              {weeks.map((week) => {
                const ordinals = ['1ra', '2da', '3ra', '4ta', '5ta'];
                const ord = ordinals[week.weekNum - 1] || `${week.weekNum}ta`;
                return (
                  <button
                    key={week.weekNum}
                    className={`sp-card sp-card-week${week.isFuture ? ' sp-card--future' : ''}${week.isCurrent ? ' sp-card--active' : ''}`}
                    onClick={() => !week.isFuture && navigate(`/selled-products/week-${week.weekNum}`)}
                    disabled={week.isFuture}
                  >
                    <span className="sp-card-eyebrow">{ord} semana</span>
                    <span className="sp-card-main sp-card-main--sm">de {monthName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mes */}
          <div className="sp-group">
            <p className="sp-group-label">Mes</p>
            <button
              className="sp-card sp-card-month"
              onClick={() => navigate('/selled-products/month')}
            >
              <span className="sp-card-eyebrow">Este mes</span>
              <span className="sp-card-main">{monthName}</span>
            </button>
          </div>

        </section>
      </div>
    </div>
  );
}

export default Inbox;
