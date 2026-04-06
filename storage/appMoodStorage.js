import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadGalleryState } from './galleryStateStorage';
import { loadTimelineByDate } from './timelineStateStorage';

const UNIFIED_KEY = 'moodi_unified_state_v1';

const EMPTY_FOUR = [null, null, null, null];

/**
 * @returns {Promise<{ timelineByDate: object, albumItems: object[], fourSlotIds: (string|null)[] }>}
 */
export async function loadMoodPersistedState() {
  try {
    const raw = await AsyncStorage.getItem(UNIFIED_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        timelineByDate: p.timelineByDate && typeof p.timelineByDate === 'object' ? p.timelineByDate : {},
        albumItems: Array.isArray(p.albumItems) ? p.albumItems : [],
        fourSlotIds:
          Array.isArray(p.fourSlotIds) && p.fourSlotIds.length === 4 ? p.fourSlotIds : [...EMPTY_FOUR],
      };
    }
  } catch {
    /* fall through to migration */
  }

  const [timelineByDate, gallery] = await Promise.all([
    loadTimelineByDate(),
    loadGalleryState(),
  ]);

  const migratedAlbum = (gallery.albumItems || []).map((it) => ({
    id: it.id,
    imageUri: it.imageUri,
    emotionId: typeof it.emotionId === 'string' ? it.emotionId : 'happy',
    memo: typeof it.memo === 'string' ? it.memo : '',
    timestamp: it.timestamp,
  }));

  return {
    timelineByDate,
    albumItems: migratedAlbum,
    fourSlotIds: gallery.fourSlotIds?.length === 4 ? gallery.fourSlotIds : [...EMPTY_FOUR],
  };
}

/**
 * @param {{ timelineByDate: object, albumItems: object[], fourSlotIds: (string|null)[] }} state
 */
export async function saveMoodPersistedState(state) {
  await AsyncStorage.setItem(UNIFIED_KEY, JSON.stringify(state));
}
