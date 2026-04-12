import { useCallback } from 'react';
import {
  applyToastShown,
  emptyDayToastState,
  getToastMessage,
  moodEntriesToEmotionEntries,
  selectToastType,
} from '../../utils/emotionToast';

export function useEmotionToastFlow({ setEmotionToastByDate }) {
  /**
   * After a new mood entry for `dateKey`, evaluate smart toast rules.
   * Pass the full day's entries including the new one, sorted by time.
   * @returns {string | null} message to show, or null
   */
  const registerEmotionToastAfterLog = useCallback(
    (dateKey, sortedDayMoodEntries) => {
      const now = new Date();
      const nowIso = now.toISOString();
      const emotionEntries = moodEntriesToEmotionEntries(sortedDayMoodEntries);
      let messageOut = null;
      setEmotionToastByDate((prev) => {
        const state = prev[dateKey] ?? emptyDayToastState();
        const type = selectToastType(emotionEntries, state, now);
        if (!type) return prev;
        messageOut = getToastMessage(type, emotionEntries);
        const next = applyToastShown(type, state, nowIso);
        return { ...prev, [dateKey]: next };
      });
      return messageOut;
    },
    [setEmotionToastByDate],
  );

  return { registerEmotionToastAfterLog };
}
