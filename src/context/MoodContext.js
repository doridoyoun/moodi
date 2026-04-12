import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  addDaysToDateKey,
  buildLegacyTimelineByDateFromEntries,
  createMoodEntry,
  getEntriesForDate,
  getEntriesForDateHour,
  normalizeMoodEntries,
  parseDateKey,
  toDateKey,
} from '../../storage/timelineStateStorage';
import { loadMoodPersistedState, normalizeGalleryByDate, saveMoodPersistedState } from '../../storage/appMoodStorage';
import {
  applyToastShown,
  emptyDayToastState,
  getToastMessage,
  moodEntriesToEmotionEntries,
  selectToastType,
} from '../../utils/emotionToast';

const CHUNKS = 6;

const EMPTY_FOUR = [null, null, null, null];

const VALID_INNER_FRAME_KEYS = new Set([
  'white',
  'black',
  'happy',
  'flutter',
  'calm',
  'gloom',
  'annoyed',
]);

function safeFour(arr) {
  if (!Array.isArray(arr) || arr.length !== 4) return [...EMPTY_FOUR];
  return [...arr];
}

function defaultDayGallery() {
  return {
    fourSlotIds: [...EMPTY_FOUR],
    moodiDaySummary: '',
    innerFrameColorKey: 'white',
  };
}

function ensureDayGallery(map, dateKey) {
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

const MoodContext = createContext(null);

function deriveTimelineAnchorFromTimestamp(iso) {
  const d = new Date(iso);
  const dateKey = toDateKey(d);
  const hour = d.getHours();
  const chunk = Math.min(CHUNKS - 1, Math.floor(d.getMinutes() / 10));
  return { dateKey, hour, chunk };
}

export function MoodProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const [albumItems, setAlbumItems] = useState([]);
  const [galleryByDate, setGalleryByDate] = useState({});
  const [emotionToastByDate, setEmotionToastByDate] = useState({});
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const hydrated = useRef(false);

  const timelineByDate = useMemo(() => buildLegacyTimelineByDateFromEntries(entries), [entries]);

  const activeDayGallery = useMemo(
    () => ensureDayGallery(galleryByDate, selectedDate),
    [galleryByDate, selectedDate],
  );

  const fourSlotIds = activeDayGallery.fourSlotIds;
  const moodiDaySummary = activeDayGallery.moodiDaySummary;
  const innerFrameColorKey = activeDayGallery.innerFrameColorKey;

  const getEntriesForSelectedDate = useCallback(() => {
    return getEntriesForDate(entries, selectedDate);
  }, [entries, selectedDate]);

  const getEntriesForHour = useCallback(
    (hour) => {
      return getEntriesForDateHour(entries, selectedDate, hour);
    },
    [entries, selectedDate],
  );

  useEffect(() => {
    let cancelled = false;
    loadMoodPersistedState().then((data) => {
      if (cancelled) return;
      setEntries(normalizeMoodEntries(data.entries));
      setAlbumItems(data.albumItems);
      setGalleryByDate(normalizeGalleryByDate(data.galleryByDate));
      setEmotionToastByDate(
        data.emotionToastByDate && typeof data.emotionToastByDate === 'object'
          ? data.emotionToastByDate
          : {},
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

  const shiftSelectedDateByDays = useCallback((delta) => {
    setSelectedDate((prev) => addDaysToDateKey(prev, delta));
  }, []);

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
  }, []);

  const updateEntry = useCallback((id, updates) => {
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
  }, []);

  const deleteEntry = useCallback((id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const applyEmotionForCurrentHour = useCallback((emotionId) => {
    const todayKey = toDateKey(new Date());
    const hour = new Date().getHours();
    createEntry({ emotionId, memo: '', dateKey: todayKey, hour });
  }, [createEntry]);

  const addAlbumItem = useCallback(({ imageUri, emotionId, memo }) => {
    const timestamp = new Date().toISOString();
    const id = `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const timelineAnchor = deriveTimelineAnchorFromTimestamp(timestamp);
    const entry = createMoodEntry({
      emotionId,
      memo: (memo || '').trim(),
      createdAt: timestamp,
    });
    const item = {
      id,
      imageUri,
      emotionId,
      memo: (memo || '').trim(),
      timestamp,
      timelineAnchor,
      moodEntryId: entry.id,
    };

    setEntries((prev) =>
      [...prev, entry].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    );
    setAlbumItems((prev) => [item, ...prev]);

    return item;
  }, []);

  const updateAlbumItem = useCallback((id, updates) => {
    setAlbumItems((prevItems) => {
      const idx = prevItems.findIndex((x) => x.id === id);
      if (idx < 0) return prevItems;
      const prevItem = prevItems[idx];
      const nextItem = {
        ...prevItem,
        emotionId: updates.emotionId ?? prevItem.emotionId,
        memo: updates.memo !== undefined ? String(updates.memo).trim() : prevItem.memo,
        timelineAnchor: prevItem.timelineAnchor ?? deriveTimelineAnchorFromTimestamp(prevItem.timestamp),
      };

      setEntries((ent) => {
        let eid = nextItem.moodEntryId;
        if (!eid && prevItem.timestamp) {
          eid = ent.find((e) => e.createdAt === prevItem.timestamp)?.id;
        }
        if (!eid) return ent;
        return ent.map((e) => {
          if (e.id !== eid) return e;
          return createMoodEntry({
            id: e.id,
            emotionId: nextItem.emotionId,
            memo: nextItem.memo,
            createdAt: e.createdAt,
          });
        });
      });

      return prevItems.map((x, j) => (j === idx ? nextItem : x));
    });
  }, []);

  const deleteAlbumItem = useCallback((albumId) => {
    setAlbumItems((prevItems) => {
      const item = prevItems.find((x) => x.id === albumId);
      if (item) {
        if (item.moodEntryId) {
          setEntries((prev) => prev.filter((e) => e.id !== item.moodEntryId));
        } else {
          setEntries((prev) => prev.filter((e) => e.createdAt !== item.timestamp));
        }
      }
      return prevItems.filter((x) => x.id !== albumId);
    });
    setGalleryByDate((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const dk of Object.keys(next)) {
        const cur = ensureDayGallery(next, dk);
        if (!cur.fourSlotIds.some((sid) => sid === albumId)) continue;
        changed = true;
        next[dk] = {
          ...cur,
          fourSlotIds: cur.fourSlotIds.map((sid) => (sid === albumId ? null : sid)),
        };
      }
      return changed ? next : prev;
    });
  }, []);

  const setFourSlotAt = useCallback(
    (index, albumId) => {
      setGalleryByDate((prev) => {
        const cur = ensureDayGallery(prev, selectedDate);
        const nextSlots = [...cur.fourSlotIds];
        nextSlots[index] = albumId;
        return { ...prev, [selectedDate]: { ...cur, fourSlotIds: nextSlots } };
      });
    },
    [selectedDate],
  );

  const clearAllFourSlots = useCallback(() => {
    setGalleryByDate((prev) => {
      const cur = ensureDayGallery(prev, selectedDate);
      return { ...prev, [selectedDate]: { ...cur, fourSlotIds: [...EMPTY_FOUR] } };
    });
  }, [selectedDate]);

  const setMoodiDaySummary = useCallback(
    (summary) => {
      const s = typeof summary === 'string' ? summary : '';
      setGalleryByDate((prev) => {
        const cur = ensureDayGallery(prev, selectedDate);
        return { ...prev, [selectedDate]: { ...cur, moodiDaySummary: s } };
      });
    },
    [selectedDate],
  );

  const setInnerFrameColorKey = useCallback(
    (key) => {
      if (typeof key !== 'string' || !VALID_INNER_FRAME_KEYS.has(key)) return;
      setGalleryByDate((prev) => {
        const cur = ensureDayGallery(prev, selectedDate);
        return { ...prev, [selectedDate]: { ...cur, innerFrameColorKey: key } };
      });
    },
    [selectedDate],
  );

  /**
   * After a new mood entry for `dateKey`, evaluate smart toast rules.
   * Pass the full day's entries including the new one, sorted by time.
   * @returns {string | null} message to show, or null
   */
  const registerEmotionToastAfterLog = useCallback((dateKey, sortedDayMoodEntries) => {
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
  }, []);

  const value = useMemo(
    () => ({
      entries,
      timelineByDate,
      selectedDate,
      setSelectedDate,
      shiftSelectedDateByDays,
      getEntriesForSelectedDate,
      getEntriesForHour,
      createEntry,
      updateEntry,
      deleteEntry,
      applyEmotionForCurrentHour,
      albumItems,
      addAlbumItem,
      updateAlbumItem,
      deleteAlbumItem,
      fourSlotIds,
      setFourSlotAt,
      clearAllFourSlots,
      moodiDaySummary,
      setMoodiDaySummary,
      innerFrameColorKey,
      setInnerFrameColorKey,
      registerEmotionToastAfterLog,
    }),
    [
      entries,
      timelineByDate,
      selectedDate,
      shiftSelectedDateByDays,
      getEntriesForSelectedDate,
      getEntriesForHour,
      createEntry,
      updateEntry,
      deleteEntry,
      applyEmotionForCurrentHour,
      albumItems,
      addAlbumItem,
      updateAlbumItem,
      deleteAlbumItem,
      fourSlotIds,
      setFourSlotAt,
      clearAllFourSlots,
      moodiDaySummary,
      setMoodiDaySummary,
      innerFrameColorKey,
      setInnerFrameColorKey,
      registerEmotionToastAfterLog,
    ],
  );

  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>;
}

export function useMood() {
  const ctx = useContext(MoodContext);
  if (!ctx) {
    throw new Error('useMood must be used within MoodProvider');
  }
  return ctx;
}
