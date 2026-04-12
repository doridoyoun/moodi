import { useEffect, useRef } from 'react';
import { loadMoodPersistedState, normalizeGalleryByDate, saveMoodPersistedState } from '../storage/mood/moodStorage';
import { normalizeMoodEntries } from '../../storage/timelineStateStorage';

/**
 * Hydration from unified storage + debounced save. Migration runs inside `loadMoodPersistedState`.
 */
export function useMoodPersistence({
  entries,
  albumItems,
  galleryByDate,
  emotionToastByDate,
  setEntries,
  setAlbumItems,
  setGalleryByDate,
  setEmotionToastByDate,
}) {
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadMoodPersistedState().then((data) => {
      if (cancelled) return;
      setEntries(normalizeMoodEntries(data.entries));
      setAlbumItems(data.albumItems);
      setGalleryByDate(normalizeGalleryByDate(data.galleryByDate));
      setEmotionToastByDate(
        data.emotionToastByDate && typeof data.emotionToastByDate === 'object' ? data.emotionToastByDate : {},
      );
      hydrated.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => {
      saveMoodPersistedState({
        entries,
        albumItems,
        galleryByDate,
        emotionToastByDate,
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [entries, albumItems, galleryByDate, emotionToastByDate]);
}
