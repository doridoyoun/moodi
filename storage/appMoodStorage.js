/**
 * @deprecated Re-export only — import from `src/storage/mood/moodStorage.js` for new code.
 * Kept so existing `storage/appMoodStorage` import paths keep working.
 */
export {
  loadMoodPersistedState,
  normalizeEmotionToastByDate,
  normalizeGalleryByDate,
  saveMoodPersistedState,
} from '../src/storage/mood/moodStorage';
