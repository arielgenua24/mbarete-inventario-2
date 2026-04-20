/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react';
import { X, Globe } from 'lucide-react';
import { useWeeklyTopProducts } from '../../hooks/useWeeklyTopProducts';
import { cacheAgeLabel } from '../../utils/cache';
import { formatCurrency } from '../../utils/orderReporting';
import './styles.css';

const SHOP_NAME = 'Mbarete jeans';
const SHOP_AVATAR =
  'https://ik.imagekit.io/arielgenua/Gemini_Generated_Image_7e70kd7e70kd7e70-removebg-preview.png';

function HighlightPill({ label, product }) {
  return (
    <div className="wtg-pill">
      <span className="wtg-pill-label">{label}</span>
      {product ? (
        <div className="wtg-pill-body">
          {product.imageUrl && (
            <img src={product.imageUrl} alt={product.name} className="wtg-pill-img" />
          )}
          <div className="wtg-pill-text">
            <span className="wtg-pill-name">{product.name}</span>
            <span className="wtg-pill-qty">{product.qty} vendidos</span>
          </div>
        </div>
      ) : (
        <span className="wtg-pill-empty">Sin ventas</span>
      )}
    </div>
  );
}

function DetailPanel({ week, isActive, onClose }) {
  const hasData = week && week.topProduct;
  const { topProduct, monthLabel, weekNum } = week || {};

  return (
    <div className="wtg-panel">
      {hasData && (
        <>
          {isActive && (
            <button className="wtg-panel-close" onClick={onClose} aria-label="Cerrar panel" style={{
              backgroundColor: 'red', color: '#fff', fontSize: '1.2rem', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', top: '10px', right: '10px', cursor: 'pointer', border: 'none', zIndex: '1000'
            }}>
              x
            </button>
          )}

          <div className="wtg-panel-media">
            {topProduct.imageUrl ? (
              <img
                src={topProduct.imageUrl}
                alt={topProduct.name}
                className="wtg-panel-img"
                loading="lazy"
              />
            ) : (
              <div className="wtg-panel-img wtg-panel-img--placeholder" />
            )}
          </div>

          <div className="wtg-panel-body">
            <span className="wtg-panel-meta">{monthLabel} · Semana {weekNum}</span>
            <h4 className="wtg-panel-name" title={topProduct.name}>{topProduct.name}</h4>
            <div className="wtg-panel-stat">
              <span className="wtg-panel-stat-value">{topProduct.qty}</span>
              <span className="wtg-panel-stat-label">vendidos</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Cell({ week, onClick, isSelected }) {
  if (!week) return <div className="wtg-cell wtg-cell--missing" aria-hidden="true" />;

  const { topProduct, isCurrent, isFuture } = week;
  const clickable = !isFuture && !!topProduct;

  const cls = [
    'wtg-cell',
    isCurrent ? 'wtg-cell--current' : '',
    isFuture ? 'wtg-cell--future' : '',
    !clickable ? 'wtg-cell--empty' : 'wtg-cell--clickable',
    isSelected ? 'wtg-cell--selected' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {clickable ? (
        <span className="wtg-cell-qty">{topProduct.qty}</span>
      ) : (
        <div className="wtg-cell-empty" />
      )}
    </div>
  );
}

function WeeklyTopGrid() {
  const { loading, weeks, highlights, totalLast4Months, cachedAt } = useWeeklyTopProducts();
  const [selectedWeek, setSelectedWeek] = useState(null);

  // Reshape flat weeks → { months: [{key, label, weeksByNum}], maxWeekNum }
  const sheet = useMemo(() => {
    const byMonth = new Map();
    let maxWeekNum = 0;
    weeks.forEach((w) => {
      if (!byMonth.has(w.monthKey)) {
        byMonth.set(w.monthKey, { key: w.monthKey, label: w.monthLabel, weeksByNum: {} });
      }
      byMonth.get(w.monthKey).weeksByNum[w.weekNum] = w;
      if (w.weekNum > maxWeekNum) maxWeekNum = w.weekNum;
    });
    return { months: Array.from(byMonth.values()), maxWeekNum };
  }, [weeks]);

  const colCount = sheet.months.length || 4;
  const isActive = selectedWeek !== null;

  // Default panel content: user-selected week, else current week, else most recent past week with data.
  const displayWeek = useMemo(() => {
    if (selectedWeek) return selectedWeek;
    const current = weeks.find((w) => w.isCurrent && w.topProduct);
    if (current) return current;
    const pastWithData = [...weeks].reverse().find((w) => w.isPast && w.topProduct);
    return pastWithData || null;
  }, [selectedWeek, weeks]);

  const handleCellClick = (week) => {
    setSelectedWeek(week);
  };

  const handleClose = () => {
    setSelectedWeek(null);
  };

  return (
    <section className="wtg-root">
      <div className="wtg-highlights">
        <HighlightPill label="Más vendido de hoy" product={highlights.today} />
        <HighlightPill label="Más vendido de la semana" product={highlights.thisWeek} />
        <HighlightPill label="Más vendido del mes pasado" product={highlights.lastMonth} />
      </div>

      <div className="wtg-board">
      <header className="wtg-header">
        <h2 className="wtg-header-title">Tus ventas por semana</h2>

        <div className="wtg-shop-row">
          <img className="wtg-shop-avatar" src={SHOP_AVATAR} alt="" />
          <span className="wtg-shop-name">{SHOP_NAME}</span>
        </div>

        <div className="wtg-total-pill">
          <span className="wtg-total-label">
            <Globe size={14} className="wtg-total-icon" />
            Total ventas de los últimos 4 meses
          </span>
          <span className="wtg-total-value">{formatCurrency(totalLast4Months)}</span>
        </div>

        {cachedAt && (
          <span className="wtg-cache-label">
            Actualizado {cacheAgeLabel(cachedAt)} · cada 2 h
          </span>
        )}
      </header>

      {loading ? (
        <div className="wtg-loading">
          <div className="wtg-spinner" />
        </div>
      ) : (
        <>
          <div className={`wtg-stage ${isActive ? 'wtg-stage--active' : ''}`}>
            <div className="wtg-stage-inner">
            <div className="wtg-column wtg-column--grid">
              <span className="wtg-column-label">Últimos 4 meses</span>
              <div
                className="wtg-sheet"
                style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
              >
                {sheet.months.map((m) => (
                  <div key={`h-${m.key}`} className="wtg-month-header">
                    {m.label}
                  </div>
                ))}

                {Array.from({ length: sheet.maxWeekNum }, (_, i) => i + 1).flatMap((weekNum) =>
                  sheet.months.map((m) => (
                    <Cell
                      key={`${m.key}-${weekNum}`}
                      week={m.weeksByNum[weekNum]}
                      onClick={() => handleCellClick(m.weeksByNum[weekNum])}
                      isSelected={
                        selectedWeek &&
                        m.weeksByNum[weekNum] &&
                        selectedWeek.monthKey === m.weeksByNum[weekNum].monthKey &&
                        selectedWeek.weekNum === m.weeksByNum[weekNum].weekNum
                      }
                    />
                  ))
                )}
              </div>
            </div>

            <div className="wtg-column wtg-column--panel">
              <span className="wtg-column-label">Producto más vendido</span>
              <DetailPanel week={displayWeek} isActive={isActive} onClose={handleClose} />
            </div>
            </div>
          </div>
        </>
      )}
      </div>

      {/* Mobile backdrop */}
      {isActive && <div className="wtg-backdrop" onClick={handleClose} />}

      {!loading && (
        <p className="wtg-footnote">
          Últimas {weeks.length} semanas. Resaltada = semana actual.
        </p>
      )}
    </section>
  );
}

export default WeeklyTopGrid;
