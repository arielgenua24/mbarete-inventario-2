import { useState, useEffect } from 'react';
import { useDesktopAnalytics } from '../../hooks/useDesktopAnalytics';
import { formatCurrency } from '../../utils/orderReporting';
import { getMonthNameEs } from '../../utils/dateUtils';
import { cacheAgeLabel } from '../../utils/cache';
import ImageModal from '../ImageModal';
import './styles.css';

const LOW_STOCK_THRESHOLD = 5;

function Thumb({ src, alt, onClick }) {
  if (!src) {
    return <div className="rap-thumb rap-thumb--empty" onClick={onClick} />;
  }
  return (
    <img
      src={src}
      alt={alt || ''}
      className="rap-thumb"
      onClick={onClick}
    />
  );
}

function BarItem({ item, value, pct, valueAriaLabel, showSizes = false }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fillPct = Math.max(4, Math.min(100, Math.round(pct))); // floor at 4% so bar is always visible
  const sizes = item.sizeBreakdown || [];
  const hasSizes = showSizes && sizes.length > 0;
  const maxSizeQty = hasSizes ? sizes[0].qty : 1;

  return (
    <>
      <div className="rap-item">
        <div className="rap-item-row">
          <Thumb
            src={item.imageUrl}
            alt={item.name}
            onClick={() => item.imageUrl && setOpen(true)}
          />
          <span className="rap-item-name">{item.name}</span>
          <span className="rap-item-value" aria-label={valueAriaLabel}>{value}</span>
          {hasSizes && (
            <button
              type="button"
              className={`rap-expand-btn${expanded ? ' rap-expand-btn--open' : ''}`}
              onClick={() => setExpanded(e => !e)}
              aria-label={expanded ? 'Ocultar talles' : 'Ver talles vendidos'}
              aria-expanded={expanded}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path
                  d="M2.5 4.25 L6 7.75 L9.5 4.25"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
        <div className="rap-bar-track">
          <div className="rap-bar-fill" style={{ width: `${fillPct}%` }} />
        </div>
        {hasSizes && expanded && (
          <ul className="rap-size-breakdown">
            {sizes.map(s => {
              const w = Math.max(4, Math.round((s.qty / maxSizeQty) * 100));
              return (
                <li key={s.size} className="rap-size-row">
                  <span className="rap-size-label">{s.size}</span>
                  <div className="rap-size-track">
                    <div className="rap-size-fill" style={{ width: `${w}%` }} />
                  </div>
                  <span className="rap-size-qty">{s.qty}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <ImageModal
        isOpen={open}
        imageSrc={item.imageUrl}
        altText={item.name}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function Section({ title, pill, children }) {
  return (
    <section className="rap-section">
      <header className="rap-section-header">
        <h3 className="rap-section-title">{title}</h3>
        <span className="rap-pill">{pill}</span>
      </header>
      {children}
    </section>
  );
}

function RightAnalyticsPanel() {
  const { loading, cachedAt, top5, bottom5, lowStock, pareto } = useDesktopAnalytics();
  const month = getMonthNameEs(new Date());

  // Tick every minute so the "hace X min" label stays current
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <aside className="rap-root">
        <div className="rap-loading">
          <div className="rap-spinner" />
        </div>
      </aside>
    );
  }

  const top5Max    = top5[0]?.qty || 1;
  const bottom5Max = bottom5[bottom5.length - 1]?.qty || 1; // largest qty in the bottom set
  const paretoMax  = pareto[0]?.pct || 1;

  return (
    <aside className="rap-root">
      <header className="rap-header">
        <span className="rap-header-kicker">Análisis · {month}</span>
        <h2 className="rap-header-title">Resumen de elementos</h2>
        {cachedAt && (
          <span className="rap-cache-label">
            Actualizado {cacheAgeLabel(cachedAt)} · se actualiza cada 2 h
          </span>
        )}
      </header>

      <div className="rap-body">

        {/* TOP 5 más vendidos */}
        <Section title="Más vendidos" pill="Top 5 mes">
          {top5.length === 0
            ? <p className="rap-empty">Sin ventas este mes</p>
            : top5.map(item => (
                <BarItem
                  key={item.id || item.name}
                  item={item}
                  value={item.qty}
                  pct={(item.qty / top5Max) * 100}
                  valueAriaLabel={`${item.qty} unidades vendidas`}
                  showSizes
                />
              ))
          }
        </Section>

        {/* Menos vendidos */}
        <Section title="Menos vendidos" pill="Cuidado">
          {bottom5.length === 0
            ? <p className="rap-empty">Sin datos</p>
            : bottom5.map(item => (
                <BarItem
                  key={item.id || item.name}
                  item={item}
                  value={item.qty}
                  pct={(item.qty / bottom5Max) * 100}
                  valueAriaLabel={`${item.qty} unidades vendidas`}
                  showSizes
                />
              ))
          }
        </Section>

        {/* Poco stock — bar fills as stock approaches 0 (urgency) */}
        <Section title="Poco stock" pill="Reabastecer">
          {lowStock.length === 0
            ? <p className="rap-empty">Stock en buen nivel</p>
            : lowStock.map(item => {
                const stock = Number(item.stock) || 0;
                const urgency = ((LOW_STOCK_THRESHOLD - stock + 1) / (LOW_STOCK_THRESHOLD + 1)) * 100;
                return (
                  <BarItem
                    key={item.id || item.name}
                    item={item}
                    value={stock}
                    pct={urgency}
                    valueAriaLabel={`Quedan ${stock} unidades`}
                  />
                );
              })
          }
        </Section>

        {/* Pareto 80/20 */}
        <Section title="Concentración de ventas" pill="20% top">
          <p className="rap-pareto-desc">
            Estos productos generan el 80% de tus ingresos. Son tu 20% más importante.
          </p>
          {pareto.length === 0
            ? <p className="rap-empty">Sin datos de ingresos</p>
            : pareto.map(item => (
                <BarItem
                  key={item.id || item.name}
                  item={item}
                  value={`${item.pct}%`}
                  pct={(item.pct / paretoMax) * 100}
                  valueAriaLabel={`${item.pct}% del total · ${formatCurrency(item.revenue)}`}
                />
              ))
          }
        </Section>

      </div>
    </aside>
  );
}

export default RightAnalyticsPanel;
