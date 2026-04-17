const MONTH_NAMES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

export function getMonthNameEs(date) {
  return MONTH_NAMES_ES[date.getMonth()];
}

export function formatDateEs(date) {
  return `${date.getDate()} de ${getMonthNameEs(date)}`;
}

export function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function getMonthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function getTodayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getTomorrowStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Returns the weeks of the month containing `date`.
 * Weeks are 7-day chunks starting on day 1 of the month:
 *   Week 1 = days 1–7, Week 2 = days 8–14, Week 3 = days 15–21,
 *   Week 4 = days 22–28, Week 5 = days 29–end (if the month has them).
 *
 * A week is:
 *   - isCurrent  → its range contains today
 *   - isFuture   → it starts after today  (grayed out, non-tappable)
 *   - isPast     → it ended before today
 *
 * @param {Date} date
 * @returns {Array<{weekNum, label, start, end, isFuture, isCurrent, isPast}>}
 */
export function getMonthWeeks(date) {
  const monthStart = getMonthStart(date);
  const monthEnd = getMonthEnd(date);
  const today = getTodayStart();

  const weeks = [];
  let weekNum = 1;
  let cursor = new Date(monthStart);

  while (cursor <= monthEnd) {
    const weekStart = new Date(cursor);

    // End of this chunk = 6 days later (7-day window)
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Clamp to month end
    const clampedEnd = weekEnd > monthEnd ? new Date(monthEnd) : weekEnd;

    const isFuture = weekStart > today;
    const isCurrent = weekStart <= today && clampedEnd >= today;
    const isPast = clampedEnd < today;

    const ordinals = ['1ra', '2da', '3ra', '4ta', '5ta'];
    const label = `${ordinals[weekNum - 1] || `${weekNum}ta`} semana\nde ${getMonthNameEs(date)}`;

    weeks.push({ weekNum, label, start: weekStart, end: clampedEnd, isFuture, isCurrent, isPast });

    weekNum++;
    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks;
}

/**
 * Returns the current week's boundaries within the current month.
 * @returns {{ start: Date, end: Date }}
 */
export function getCurrentWeekBounds() {
  const today = new Date();
  const weeks = getMonthWeeks(today);
  const current = weeks.find(w => w.isCurrent);
  if (current) return { start: current.start, end: current.end };
  return { start: getTodayStart(), end: getTomorrowStart() };
}
