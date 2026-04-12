import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadGalleryState } from './galleryStateStorage';
import {
  loadTimelineByDate,
  migrateLegacyTimelineByDateToEntries,
  normalizeMoodEntries,
  toDateKey,
} from './timelineStateStorage';

const UNIFIED_KEY_V2 = 'moodi_unified_state_v2';
const UNIFIED_KEY_V1 = 'moodi_unified_state_v1';

/**
 * @param {unknown} raw
 * @returns {Record<string, { todayToastCount: number, shownToastTypes: string[], lastToastAt: string | null }>}
 */
function normalizeEmotionToastByDate(raw) {
  if (!raw || typeof raw !== 'object') return {};
  /** @type {Record<string, { todayToastCount: number, shownToastTypes: string[], lastToastAt: string | null }>} */
  const out = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key.trim())) continue;
    const k = key.trim();
    if (!val || typeof val !== 'object') continue;
    const v = /** @type {Record<string, unknown>} */ (val);
    const count = typeof v.todayToastCount === 'number' && v.todayToastCount >= 0 ? v.todayToastCount : 0;
    const shown = Array.isArray(v.shownToastTypes)
      ? v.shownToastTypes.filter((x) => typeof x === 'string')
      : [];
    let last = null;
    if (typeof v.lastToastAt === 'string' && !Number.isNaN(Date.parse(v.lastToastAt))) {
      last = v.lastToastAt;
    }
    out[k] = { todayToastCount: count, shownToastTypes: shown, lastToastAt: last };
  }
  return out;
}

const EMPTY_FOUR = [null, null, null, null];

const INNER_FRAME_LEGACY_KEY = 'moodiGalleryInnerFrameColor';
const VALID_INNER_FRAME_KEYS = new Set([
  'white',
  'black',
  'happy',
  'flutter',
  'calm',
  'gloom',
  'annoyed',
]);

function safeAlbumItems(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((it) => {
    if (!it || typeof it !== 'object') {
      return {
        id: `g-${Date.now()}`,
        imageUri: '',
        emotionId: 'happy',
        memo: '',
        timestamp: new Date().toISOString(),
      };
    }
    let timestamp = it.timestamp;
    if (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp))) {
      timestamp = new Date().toISOString();
    }
    return {
      id: typeof it.id === 'string' ? it.id : `g-${Date.now()}`,
      imageUri: typeof it.imageUri === 'string' ? it.imageUri : '',
      emotionId: typeof it.emotionId === 'string' ? it.emotionId : 'happy',
      memo: typeof it.memo === 'string' ? it.memo : '',
      timestamp,
      ...(it.timelineAnchor && typeof it.timelineAnchor === 'object' ? { timelineAnchor: it.timelineAnchor } : {}),
    };
  });
}

function safeFour(arr) {
  if (!Array.isArray(arr) || arr.length !== 4) return [...EMPTY_FOUR];
  return [...arr];
}

function normalizeInnerFrameKey(raw) {
  if (typeof raw === 'string' && VALID_INNER_FRAME_KEYS.has(raw)) return raw;
  return 'white';
}

/**
 * @param {unknown} raw
 * @returns {Record<string, { fourSlotIds: (string|null)[], moodiDaySummary: string, innerFrameColorKey: string }>}
 */
export function normalizeGalleryByDate(raw) {
  if (!raw || typeof raw !== 'object') return {};
  /** @type {Record<string, { fourSlotIds: (string|null)[], moodiDaySummary: string, innerFrameColorKey: string }>} */
  const out = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key.trim())) continue;
    const k = key.trim();
    if (!val || typeof val !== 'object') continue;
    out[k] = {
      fourSlotIds: safeFour(val.fourSlotIds),
      moodiDaySummary: typeof val.moodiDaySummary === 'string' ? val.moodiDaySummary : '',
      innerFrameColorKey: normalizeInnerFrameKey(val.innerFrameColorKey),
    };
  }
  return out;
}

/**
 * @returns {Promise<{ entries: object[], albumItems: object[], galleryByDate: Record<string, { fourSlotIds: (string|null)[], moodiDaySummary: string, innerFrameColorKey: string }>, emotionToastByDate: Record<string, { todayToastCount: number, shownToastTypes: string[], lastToastAt: string | null }> }>}
 */
export async function loadMoodPersistedState() {
  try {
    const rawV2 = await AsyncStorage.getItem(UNIFIED_KEY_V2);
    if (rawV2) {
      const p = JSON.parse(rawV2);
      const entries = normalizeMoodEntries(p.entries);
      let galleryByDate = normalizeGalleryByDate(p.galleryByDate);
      const hasPerDay = p.galleryByDate && typeof p.galleryByDate === 'object';

      if (!hasPerDay || Object.keys(galleryByDate).length === 0) {
        const todayKey = toDateKey(new Date());
        let frameKey = 'white';
        try {
          const legacyFrame = await AsyncStorage.getItem(INNER_FRAME_LEGACY_KEY);
          if (typeof legacyFrame === 'string' && VALID_INNER_FRAME_KEYS.has(legacyFrame)) {
            frameKey = legacyFrame;
          }
        } catch {
          /* ignore */
        }
        galleryByDate = {
          ...galleryByDate,
          [todayKey]: {
            fourSlotIds: safeFour(p.fourSlotIds),
            moodiDaySummary: typeof p.moodiDaySummary === 'string' ? p.moodiDaySummary : '',
            innerFrameColorKey: frameKey,
          },
        };
      }

      return {
        entries,
        albumItems: safeAlbumItems(p.albumItems),
        galleryByDate,
        emotionToastByDate: normalizeEmotionToastByDate(p.emotionToastByDate),
      };
    }
  } catch {
    /* fall through */
  }

  try {
    const rawV1 = await AsyncStorage.getItem(UNIFIED_KEY_V1);
    if (rawV1) {
      const p = JSON.parse(rawV1);
      let entries = [];
      if (Array.isArray(p.entries) && p.entries.length > 0) {
        entries = normalizeMoodEntries(p.entries);
      } else if (p.timelineByDate && typeof p.timelineByDate === 'object') {
        entries = migrateLegacyTimelineByDateToEntries(p.timelineByDate);
      }
      const todayKey = toDateKey(new Date());
      let frameKey = 'white';
      try {
        const legacyFrame = await AsyncStorage.getItem(INNER_FRAME_LEGACY_KEY);
        if (typeof legacyFrame === 'string' && VALID_INNER_FRAME_KEYS.has(legacyFrame)) {
          frameKey = legacyFrame;
        }
      } catch {
        /* ignore */
      }
      return {
        entries,
        albumItems: safeAlbumItems(p.albumItems),
        galleryByDate: {
          [todayKey]: {
            fourSlotIds: safeFour(p.fourSlotIds),
            moodiDaySummary: typeof p.moodiDaySummary === 'string' ? p.moodiDaySummary : '',
            innerFrameColorKey: frameKey,
          },
        },
        emotionToastByDate: {},
      };
    }
  } catch {
    /* fall through */
  }

  const [timelineByDate, gallery] = await Promise.all([loadTimelineByDate(), loadGalleryState()]);

  const entries = migrateLegacyTimelineByDateToEntries(
    timelineByDate && typeof timelineByDate === 'object' ? timelineByDate : {},
  );

  const migratedAlbum = safeAlbumItems(gallery.albumItems || []);
  const todayKey = toDateKey(new Date());
  let frameKey = 'white';
  try {
    const legacyFrame = await AsyncStorage.getItem(INNER_FRAME_LEGACY_KEY);
    if (typeof legacyFrame === 'string' && VALID_INNER_FRAME_KEYS.has(legacyFrame)) {
      frameKey = legacyFrame;
    }
  } catch {
    /* ignore */
  }

  return {
    entries,
    albumItems: migratedAlbum,
    galleryByDate: {
      [todayKey]: {
        fourSlotIds: safeFour(gallery.fourSlotIds),
        moodiDaySummary: '',
        innerFrameColorKey: frameKey,
      },
    },
    emotionToastByDate: {},
  };
}

/**
 * @param {{ entries: object[], albumItems: object[], galleryByDate: Record<string, unknown>, emotionToastByDate?: Record<string, unknown> }} state
 */
export async function saveMoodPersistedState(state) {
  const normalizedEntries = normalizeMoodEntries(state.entries || []);
  const safeAlbum = safeAlbumItems(state.albumItems || []);
  const galleryByDate = normalizeGalleryByDate(state.galleryByDate);
  const emotionToastByDate = normalizeEmotionToastByDate(state.emotionToastByDate);

  await AsyncStorage.setItem(
    UNIFIED_KEY_V2,
    JSON.stringify({
      entries: normalizedEntries,
      albumItems: safeAlbum,
      galleryByDate,
      emotionToastByDate,
    }),
  );
}
