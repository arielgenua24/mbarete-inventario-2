import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useFirestoreContext from '../../hooks/useFirestoreContext'
import {
  getTodayStart,
  getTomorrowStart,
  getMonthStart,
  getMonthEnd,
  getMonthWeeks,
  getMonthNameEs,
  formatDateEs,
} from '../../utils/dateUtils'
import {
  getWithTTL,
  getWithTTLOrStale,
  setWithTTL,
  cacheAgeLabel,
  todayKey,
  weekKey,
  monthKey,
  TTL_1H,
} from '../../utils/cache'
import './styles.css'

// Sum item counts from order documents
function computeItemCount(orders) {
  return orders.reduce((total, order) => {
    if (Array.isArray(order.products) && order.products.length > 0) {
      return total + order.products.reduce((s, p) => s + (p.quantity || p.stock || 0), 0)
    }
    return total + (order.itemCount || 0)
  }, 0)
}

// Returns { key, isTTL } or null.
// isTTL=true  → 1-hour TTL cache (current/mutable periods)
// isTTL=false → permanent cache (past periods, counts never change)
function resolveCacheKey(period, weeks) {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')

  if (period === 'today') {
    return { key: todayKey('mb_ttl_today'), isTTL: true }
  }
  if (period === 'month') {
    return { key: monthKey('mb_ttl_month'), isTTL: true }
  }
  if (period.startsWith('week-')) {
    const num = parseInt(period.replace('week-', ''), 10)
    const week = weeks.find(w => w.weekNum === num)
    if (!week) return null
    if (week.isPast) {
      return { key: `mb_sold_week_${y}_${m}_${num}`, isTTL: false }
    }
    return { key: weekKey('mb_ttl_week', num), isTTL: true }
  }
  return null
}

function getDateRange(period, weeks) {
  const today = new Date()
  if (period === 'today') {
    return { start: getTodayStart(), end: getTomorrowStart() }
  }
  if (period === 'month') {
    return { start: getMonthStart(today), end: getMonthEnd(today) }
  }
  if (period.startsWith('week-')) {
    const num = parseInt(period.replace('week-', ''), 10)
    const week = weeks.find(w => w.weekNum === num)
    if (week) return { start: week.start, end: week.end }
  }
  return null
}

const LOGO_URL = 'https://ik.imagekit.io/arielgenua/ChatGPT%20Image%206%20abr%202026,%2005_54_51%20p.m..png?updatedAt=1775508927579'

function buildMessage(period, count, weeks) {
  const today = new Date()
  const monthName = getMonthNameEs(today)
  const dateStr = formatDateEs(today)

  if (period === 'today') {
    return (
      <>
        Hola Majo, hoy {dateStr} has vendido{' '}
        <span className="sp-chat-count">{count}</span> prendas
      </>
    )
  }

  if (period === 'month') {
    return (
      <>
        Hola Majo, este mes de {monthName} has vendido{' '}
        <span className="sp-chat-count">{count}</span> prendas en total
      </>
    )
  }

  if (period.startsWith('week-')) {
    const num = parseInt(period.replace('week-', ''), 10)
    const week = weeks.find(w => w.weekNum === num)
    const ordinals = ['primera', 'segunda', 'tercera', 'cuarta', 'quinta']
    const ordinal = ordinals[num - 1] || `${num}ta`

    if (week?.isCurrent) {
      return (
        <>
          Hola Majo, esta semana de {monthName} has vendido{' '}
          <span className="sp-chat-count">{count}</span> prendas
        </>
      )
    }
    return (
      <>
        Hola Majo, la {ordinal} semana de {monthName} has vendido{' '}
        <span className="sp-chat-count">{count}</span> prendas
      </>
    )
  }

  return <>Hola Majo, has vendido <span className="sp-chat-count">{count}</span> prendas</>
}

function SoldProductsDetail() {
  const { period } = useParams()
  const navigate = useNavigate()
  const { getOrdersByDateRangeBounded } = useFirestoreContext()

  const today = new Date()
  const weeks = getMonthWeeks(today)

  const [count, setCount] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [cacheInfo, setCacheInfo] = useState(null)

  useEffect(() => {
    const resolved = resolveCacheKey(period, weeks)

    if (!resolved) {
      setCount(0)
      setIsLoading(false)
      return
    }

    const { key, isTTL } = resolved

    // TTL path: serve instantly from cache if still fresh
    if (isTTL) {
      const cached = getWithTTL(key)
      if (cached) {
        setCount(cached.data.count)
        setCacheInfo({ cachedAt: cached.cachedAt, isStale: false })
        setIsLoading(false)
        return
      }
    } else {
      // Permanent path: past periods never change
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const { count: c, isPast } = JSON.parse(raw)
          if (isPast) {
            setCount(c)
            setCacheInfo(null)
            setIsLoading(false)
            return
          }
        }
      } catch { /* ignore */ }
    }

    const range = getDateRange(period, weeks)
    if (!range) {
      setCount(0)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    getOrdersByDateRangeBounded(range.start, range.end)
      .then(orders => {
        const total = computeItemCount(orders)
        setCount(total)
        setCacheInfo(null)

        if (isTTL) {
          setWithTTL(key, { count: total }, TTL_1H)
        } else {
          const isPast = range.end < getTodayStart()
          if (isPast) {
            try {
              localStorage.setItem(key, JSON.stringify({ count: total, isPast: true }))
            } catch { /* ignore */ }
          }
        }
      })
      .catch(err => {
        console.error('Error fetching sold products:', err)
        // Last resort: show stale data even if TTL expired
        if (isTTL) {
          const stale = getWithTTLOrStale(key)
          if (stale) {
            setCount(stale.data.count)
            setCacheInfo({ cachedAt: stale.cachedAt, isStale: true })
            return
          }
        }
        setCount(0)
      })
      .finally(() => setIsLoading(false))
  }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="sp-page">
      <button className="sp-back-pill" onClick={() => navigate('/inbox')}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{marginRight: '2px'}}>
          <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Volver
      </button>

      <div className="sp-chat">
        <div className="sp-chat-avatar">
          <img src={LOGO_URL} alt="Mbarete Inventory" />
        </div>
        <div className="sp-chat-bubble">
          {isLoading ? (
            <p className="sp-chat-loading">
              <span className="sp-chat-dot" />
              <span className="sp-chat-dot" />
              <span className="sp-chat-dot" />
            </p>
          ) : (
            <>
              <p className="sp-chat-message">
                {buildMessage(period, count, weeks)}
              </p>
              {cacheInfo && (
                <p className="sp-cache-note">
                  {cacheInfo.isStale
                    ? `Sin conexión · ${cacheAgeLabel(cacheInfo.cachedAt)}`
                    : `Datos de ${cacheAgeLabel(cacheInfo.cachedAt)}`}
                </p>
              )}
              <span className="sp-refresh-note">
                En aproximadamente una hora tendrás un resumen de las nuevas ventas
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SoldProductsDetail
