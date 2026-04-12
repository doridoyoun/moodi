/**
 * Unified mood persistence: read/write only for the current on-disk schema (moodi_unified_state_v2).
 * Migration from older keys/schemas: @see ../../migrations/moodStateMigration.js
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  migrateLoadMoodState,
  normalizeEmotionToastByDate,
  normalizeGalleryByDate,
  safeAlbumItems,
} from '../../migrations/moodStateMigration';
import { normalizeMoodEntries } from '../../../storage/timelineStateStorage';

const UNIFIED_KEY_V2 = 'moodi_unified_state_v2';

/**
 * @param {unknown} raw
 * @returns {Record<string, { todayToastCount: number, shownToastTypes: string[], lastToastAt: string | null }>}
 */
export { normalizeEmotionToastByDate };

/**
 * @param {unknown} raw
 * @returns {Record<string, { fourSlotIds: (string|null)[], moodiDaySummary: string, innerFrameColorKey: string }>}
 */
export { normalizeGalleryByDate };

export async function loadMoodPersistedState() {
  return migrateLoadMoodState();
}

/**
 * @param {{
 *   entries: unknown,
 *   albumItems: unknown,
 *   galleryByDate: unknown,
 *   emotionToastByDate: unknown,
 * }} data
 */
export async function saveMoodPersistedState(data) {
  const payload = {
    entries: normalizeMoodEntries(data.entries || []),
    albumItems: safeAlbumItems(data.albumItems || []),
    galleryByDate: normalizeGalleryByDate(data.galleryByDate),
    emotionToastByDate: normalizeEmotionToastByDate(data.emotionToastByDate),
  };
  await AsyncStorage.setItem(UNIFIED_KEY_V2, JSON.stringify(payload));
}
