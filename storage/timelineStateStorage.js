import AsyncStorage from '@react-native-async-storage/async-storage';

const TIMELINE_BY_DATE_KEY = 'moodi_timeline_by_date_v1';

/**
 * @typedef {{ emotionId: string, count: number, memo?: string }} ChunkCell
 * @typedef {(ChunkCell|null)[]} ChunkRow
 * @typedef {Record<number, ChunkRow>} HourChunksMap
 * @typedef {Record<string, HourChunksMap>} TimelineByDate
 */

export function createEmptyChunks() {
  return Array.from({ length: 6 }, () => null);
}

export function createEmptyHourMap() {
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  return Object.fromEntries(HOURS.map((h) => [h, createEmptyChunks()]));
}

function normalizeHourMap(raw) {
  const out = createEmptyHourMap();
  if (!raw || typeof raw !== 'object') return out;
  for (let h = 0; h < 24; h += 1) {
    const row = raw[h] ?? raw[String(h)];
    if (Array.isArray(row) && row.length === 6) {
      out[h] = row.map((c) =>
        c && c.emotionId && typeof c.count === 'number'
          ? {
              emotionId: c.emotionId,
              count: c.count,
              ...(typeof c.memo === 'string' ? { memo: c.memo } : {}),
            }
          : null,
      );
    }
  }
  return out;
}

/**
 * @returns {Promise<TimelineByDate>}
 */
export async function loadTimelineByDate() {
  try {
    const raw = await AsyncStorage.getItem(TIMELINE_BY_DATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out = {};
    Object.keys(parsed).forEach((dateKey) => {
      out[dateKey] = normalizeHourMap(parsed[dateKey]);
    });
    return out;
  } catch {
    return {};
  }
}

/**
 * @param {TimelineByDate} data
 */
export async function saveTimelineByDate(data) {
  await AsyncStorage.setItem(TIMELINE_BY_DATE_KEY, JSON.stringify(data));
}

export function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * "YYYY-MM-DD" 문자열을 안전하게 파싱 (ISO 문자열 결합 대신 split 사용)
 * @returns {{ year: number, monthIndex: number, day: number } | null}
 */
export function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string') return null;
  const parts = dateKey.trim().split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return { year: y, monthIndex: mo - 1, day: d };
}

/**
 * 로컬 정오 기준 Date (타임존/파싱 이슈 완화)
 * @param {string} dateKey
 * @returns {Date}
 */
export function localDateFromDateKey(dateKey) {
  const p = parseDateKey(dateKey);
  if (!p) return new Date(NaN);
  return new Date(p.year, p.monthIndex, p.day, 12, 0, 0, 0);
}

/**
 * @param {string} dateKey
 * @param {number} deltaDays
 * @returns {string} YYYY-MM-DD
 */
export function addDaysToDateKey(dateKey, deltaDays) {
  const dt = localDateFromDateKey(dateKey);
  if (Number.isNaN(dt.getTime())) return toDateKey(new Date());
  dt.setDate(dt.getDate() + deltaDays);
  return toDateKey(dt);
}

/**
 * 표시용 로케일 문자열
 * @param {string} dateKey
 * @param {string} [locale='ko-KR']
 */
export function formatDateKeyForDisplay(dateKey, locale = 'ko-KR') {
  const dt = localDateFromDateKey(dateKey);
  if (Number.isNaN(dt.getTime())) return dateKey;
  return dt.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

/**
 * 하루 칸 데이터에서 가장 많이 기록된(가중 count 합) 감정 id
 * @param {HourChunksMap|undefined|null} dayMap
 * @returns {string|null}
 */
function tallyEmotionsForDay(dayMap) {
  const tallies = {};
  if (!dayMap) return tallies;
  for (let h = 0; h < 24; h += 1) {
    const row = dayMap[h];
    if (!row) continue;
    for (const cell of row) {
      if (!cell?.emotionId) continue;
      tallies[cell.emotionId] = (tallies[cell.emotionId] || 0) + cell.count;
    }
  }
  return tallies;
}

export function computeRepresentativeEmotionId(dayMap) {
  const tallies = tallyEmotionsForDay(dayMap);
  const ids = Object.keys(tallies);
  if (ids.length === 0) return null;
  return ids.sort((a, b) => tallies[b] - tallies[a])[0];
}

/**
 * 가중 count 합 기준 상위 1·2위 감정 id (캘린더 그라데이션용)
 * @param {HourChunksMap|undefined|null} dayMap
 * @returns {string[]} 길이 0~2
 */
export function computeTopTwoEmotionIds(dayMap) {
  const tallies = tallyEmotionsForDay(dayMap);
  const ids = Object.keys(tallies);
  if (ids.length === 0) return [];
  ids.sort((a, b) => tallies[b] - tallies[a]);
  return ids.slice(0, 2);
}
