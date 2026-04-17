const SCHEMA_V = 1
export const TTL_1H = 60 * 60 * 1000

// ── Key builders ────────────────────────────────────────────────────

function dateSuffix() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}_${m}_${dd}`
}

function monthSuffix() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}_${m}`
}

export function todayKey(prefix) {
  return `${prefix}_${dateSuffix()}`
}

export function weekKey(prefix, weekNum) {
  return `${prefix}_${monthSuffix()}_${weekNum}`
}

export function monthKey(prefix) {
  return `${prefix}_${monthSuffix()}`
}

// ── Core TTL read/write ──────────────────────────────────────────────

/**
 * Returns { data, cachedAt } if the entry exists and is within TTL.
 * Returns null otherwise.
 */
export function getWithTTL(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (entry.v !== SCHEMA_V) return null
    if (Date.now() > entry.expiresAt) return null
    return { data: entry.data, cachedAt: entry.cachedAt }
  } catch {
    return null
  }
}

/**
 * Like getWithTTL but also returns expired entries, flagged with isStale: true.
 * Use this as a last-resort fallback when a network fetch fails.
 */
export function getWithTTLOrStale(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (entry.v !== SCHEMA_V) return null
    const isStale = Date.now() > entry.expiresAt
    return { data: entry.data, cachedAt: entry.cachedAt, isStale }
  } catch {
    return null
  }
}

/**
 * Writes a TTL entry. Silently drops on QuotaExceededError (prunes old keys first).
 */
export function setWithTTL(key, data, ttlMs = TTL_1H) {
  try {
    const now = Date.now()
    localStorage.setItem(key, JSON.stringify({
      v: SCHEMA_V,
      cachedAt: now,
      expiresAt: now + ttlMs,
      data,
    }))
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      pruneExpiredTTLKeys()
    }
  }
}

// ── Quota management ────────────────────────────────────────────────

function pruneExpiredTTLKeys() {
  try {
    const now = Date.now()
    const toDelete = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('mb_ttl_')) continue
      try {
        const entry = JSON.parse(localStorage.getItem(key))
        if (!entry || entry.expiresAt < now) toDelete.push(key)
      } catch {
        toDelete.push(key)
      }
    }
    toDelete.forEach(k => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}

// ── Display helpers ──────────────────────────────────────────────────

/**
 * Returns a Spanish age label like "hace 23 min" or "hace 2 h".
 */
export function cacheAgeLabel(cachedAt) {
  const minutes = Math.floor((Date.now() - cachedAt) / 60_000)
  if (minutes < 1) return 'hace menos de 1 min'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `hace ${hours} h`
}
