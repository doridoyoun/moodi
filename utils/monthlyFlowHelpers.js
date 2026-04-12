import { moodOrder, moodPalette } from '../constants/theme';
import { getEntriesForDate } from '../storage/timelineStateStorage';

const DEFAULT_BAR = '#e8ecf0';

/**
 * Last N emotion background colors for a day (chronological order, tail = most recent window).
 * @param {object[]} entries
 * @param {string} dateKey
 * @param {number} maxN
 * @returns {string[]}
 */
export function emotionBgSequenceForDay(entries, dateKey, maxN = 6) {
  const list = getEntriesForDate(entries, dateKey);
  const sorted = [...list].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const tail = sorted.slice(-maxN);
  return tail.map((e) => moodPalette[e.emotionId]?.bg ?? DEFAULT_BAR);
}

/**
 * Counts mood entries per top-level category for one day (one record → one count).
 * Only the five categories in `moodOrder` are counted; order is fixed for callers.
 *
 * @param {object[]} entries
 * @param {string} dateKey
 * @returns {Record<string, number>}
 */
export function countEmotionsByTopCategoryForDay(entries, dateKey) {
  const counts = Object.fromEntries(moodOrder.map((id) => [id, 0]));
  const list = getEntriesForDate(entries, dateKey);
  for (const e of list) {
    const id = e?.emotionId;
    if (id && Object.prototype.hasOwnProperty.call(counts, id)) {
      counts[id] += 1;
    }
  }
  return counts;
}

/**
 * @param {object[]} entries
 * @param {number} year
 * @param {number} monthIndex 0–11
 * @returns {{ dateKey: string, label: string, counts: Record<string, number>, total: number }[]}
 */
export function buildMonthFlowRows(entries, year, monthIndex) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const rows = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    const m = String(monthIndex + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const dateKey = `${year}-${m}-${dd}`;
    const counts = countEmotionsByTopCategoryForDay(entries, dateKey);
    const total = moodOrder.reduce((sum, id) => sum + counts[id], 0);
    rows.push({
      dateKey,
      label: `${monthIndex + 1}/${String(d).padStart(2, '0')}`,
      counts,
      total,
    });
  }
  return rows;
}
