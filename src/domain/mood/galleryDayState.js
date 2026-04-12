/**
 * Per-day gallery UI state (four slots, summary, frame color). Persisted under `galleryByDate` in unified storage.
 * Source of truth on disk: unified `galleryByDate`; this module is shape helpers only.
 */

export const EMPTY_FOUR = [null, null, null, null];

export const VALID_INNER_FRAME_KEYS = new Set([
  'white',
  'black',
  'happy',
  'flutter',
  'calm',
  'gloom',
  'annoyed',
]);

export function safeFour(arr) {
  if (!Array.isArray(arr) || arr.length !== 4) return [...EMPTY_FOUR];
  return [...arr];
}

export function defaultDayGallery() {
  return {
    fourSlotIds: [...EMPTY_FOUR],
    moodiDaySummary: '',
    innerFrameColorKey: 'white',
  };
}

/**
 * @param {Record<string, unknown>} map
 * @param {string} dateKey
 */
export function ensureDayGallery(map, dateKey) {
  const raw = map?.[dateKey];
  if (!raw || typeof raw !== 'object') {
    return defaultDayGallery();
  }
  return {
    fourSlotIds: safeFour(raw.fourSlotIds),
    moodiDaySummary: typeof raw.moodiDaySummary === 'string' ? raw.moodiDaySummary : '',
    innerFrameColorKey:
      typeof raw.innerFrameColorKey === 'string' && VALID_INNER_FRAME_KEYS.has(raw.innerFrameColorKey)
        ? raw.innerFrameColorKey
        : 'white',
  };
}
