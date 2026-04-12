import { useCallback } from 'react';
import {
  addDaysToDateKey,
  createMoodEntry,
  getEntriesForDate,
  getEntriesForDateHour,
  parseDateKey,
  toDateKey,
} from '../../storage/timelineStateStorage';

export function useMoodEntries({ entries, setEntries, selectedDate, setSelectedDate }) {
  const getEntriesForSelectedDate = useCallback(() => {
    return getEntriesForDate(entries, selectedDate);
  }, [entries, selectedDate]);

  const getEntriesForHour = useCallback(
    (hour) => {
      return getEntriesForDateHour(entries, selectedDate, hour);
    },
    [entries, selectedDate],
  );

  const shiftSelectedDateByDays = useCallback((delta) => {
    setSelectedDate((prev) => addDaysToDateKey(prev, delta));
  }, [setSelectedDate]);

  const createEntry = useCallback(({ emotionId, memo = '', dateKey, hour }) => {
    const p = parseDateKey(dateKey);
    if (!p) return null;
    const entry = createMoodEntry({
      emotionId,
      memo: typeof memo === 'string' ? memo : '',
      createdAt: new Date().toISOString(),
      timelineDateKey: dateKey,
      timelineHour: hour,
    });
    setEntries((prev) =>
      [...prev, entry].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    );
    return entry;
  }, [setEntries]);

  const updateEntry = useCallback(
    (id, updates) => {
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e;
          const emotionId = updates.emotionId !== undefined ? updates.emotionId : e.emotionId;
          const memo = updates.memo !== undefined ? String(updates.memo).trim() : e.memo;
          return createMoodEntry({
            id: e.id,
            emotionId,
            memo,
            createdAt: e.createdAt,
            timelineDateKey: e.timelineDateKey,
            timelineHour: e.timelineHour,
          });
        }),
      );
    },
    [setEntries],
  );

  const deleteEntry = useCallback(
    (id) => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    },
    [setEntries],
  );

  const applyEmotionForCurrentHour = useCallback(
    (emotionId) => {
      const todayKey = toDateKey(new Date());
      const hour = new Date().getHours();
      createEntry({ emotionId, memo: '', dateKey: todayKey, hour });
    },
    [createEntry],
  );

  return {
    getEntriesForSelectedDate,
    getEntriesForHour,
    shiftSelectedDateByDays,
    createEntry,
    updateEntry,
    deleteEntry,
    applyEmotionForCurrentHour,
  };
}
