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
  createEmptyChunks,
  createEmptyHourMap,
  toDateKey,
} from '../../storage/timelineStateStorage';
import { loadMoodPersistedState, saveMoodPersistedState } from '../../storage/appMoodStorage';

const CHUNKS = 6;

const MoodContext = createContext(null);

function deriveTimelineAnchorFromTimestamp(iso) {
  const d = new Date(iso);
  const dateKey = toDateKey(d);
  const hour = d.getHours();
  const chunk = Math.min(CHUNKS - 1, Math.floor(d.getMinutes() / 10));
  return { dateKey, hour, chunk };
}

function applyAlbumItemToTimelineSlot(prev, item) {
  const anchor = item.timelineAnchor ?? deriveTimelineAnchorFromTimestamp(item.timestamp);
  const { dateKey, hour, chunk } = anchor;
  const prevDay = prev[dateKey] ?? createEmptyHourMap();
  const row = [...(prevDay[hour] ?? createEmptyChunks())];
  row[chunk] = {
    emotionId: item.emotionId,
    count: 1,
    memo: (item.memo || '').trim(),
  };
  return { ...prev, [dateKey]: { ...prevDay, [hour]: row } };
}

function clearAlbumFromTimeline(prev, item) {
  const anchor = item.timelineAnchor ?? deriveTimelineAnchorFromTimestamp(item.timestamp);
  const { dateKey, hour, chunk } = anchor;
  const prevDay = prev[dateKey] ?? createEmptyHourMap();
  const row = [...(prevDay[hour] ?? createEmptyChunks())];
  row[chunk] = null;
  return { ...prev, [dateKey]: { ...prevDay, [hour]: row } };
}

function mergeChunkCell(prevCell, emotionId, memoText) {
  const memo = (memoText || '').trim();
  if (!prevCell) {
    return { emotionId, count: 1, memo };
  }
  if (prevCell.emotionId === emotionId) {
    return {
      emotionId,
      count: Math.min(3, prevCell.count + 1),
      memo: memo || prevCell.memo || '',
    };
  }
  return { emotionId, count: 1, memo };
}

function mergeChunkManual(prevCell, emotionId) {
  if (!prevCell) {
    return { emotionId, count: 1, memo: '' };
  }
  if (prevCell.emotionId === emotionId) {
    return {
      emotionId,
      count: Math.min(3, prevCell.count + 1),
      memo: prevCell.memo ?? '',
    };
  }
  return { emotionId, count: 1, memo: '' };
}

export function MoodProvider({ children }) {
  const [timelineByDate, setTimelineByDate] = useState({});
  const [albumItems, setAlbumItems] = useState([]);
  const [fourSlotIds, setFourSlotIds] = useState([null, null, null, null]);
  const [moodiDaySummary, setMoodiDaySummary] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadMoodPersistedState().then((data) => {
      if (cancelled) return;
      setTimelineByDate(data.timelineByDate);
      setAlbumItems(data.albumItems);
      setFourSlotIds(data.fourSlotIds);
      setMoodiDaySummary(data.moodiDaySummary ?? '');
      hydrated.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => {
      saveMoodPersistedState({ timelineByDate, albumItems, fourSlotIds, moodiDaySummary }).catch(
        () => {},
      );
    }, 400);
    return () => clearTimeout(t);
  }, [timelineByDate, albumItems, fourSlotIds, moodiDaySummary]);

  const shiftSelectedDateByDays = useCallback((delta) => {
    setSelectedDate((prev) => addDaysToDateKey(prev, delta));
  }, []);

  const applyEmotionForCurrentHour = useCallback((emotionId) => {
    const todayKey = toDateKey(new Date());
    const hour = new Date().getHours();
    const minute = new Date().getMinutes();
    const chunk = Math.min(CHUNKS - 1, Math.floor(minute / 10));

    setTimelineByDate((prev) => {
      const prevDay = prev[todayKey] ?? createEmptyHourMap();
      const row = [...(prevDay[hour] ?? createEmptyChunks())];
      const prevCell = row[chunk];
      row[chunk] = mergeChunkManual(prevCell, emotionId);
      const nextDay = { ...prevDay, [hour]: row };
      return { ...prev, [todayKey]: nextDay };
    });
  }, []);

  const addAlbumItem = useCallback(({ imageUri, emotionId, memo }) => {
    const timestamp = new Date().toISOString();
    const id = `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const timelineAnchor = deriveTimelineAnchorFromTimestamp(timestamp);
    const item = {
      id,
      imageUri,
      emotionId,
      memo: (memo || '').trim(),
      timestamp,
      timelineAnchor,
    };

    setAlbumItems((prev) => [item, ...prev]);

    setTimelineByDate((prev) => {
      const prevDay = prev[timelineAnchor.dateKey] ?? createEmptyHourMap();
      const row = [...(prevDay[timelineAnchor.hour] ?? createEmptyChunks())];
      const prevCell = row[timelineAnchor.chunk];
      row[timelineAnchor.chunk] = mergeChunkCell(prevCell, emotionId, item.memo);
      return { ...prev, [timelineAnchor.dateKey]: { ...prevDay, [timelineAnchor.hour]: row } };
    });

    return item;
  }, []);

  const updateAlbumItem = useCallback((id, updates) => {
    let nextItem = null;
    setAlbumItems((prevItems) => {
      const idx = prevItems.findIndex((x) => x.id === id);
      if (idx < 0) return prevItems;
      const prevItem = prevItems[idx];
      nextItem = {
        ...prevItem,
        emotionId: updates.emotionId ?? prevItem.emotionId,
        memo: updates.memo !== undefined ? String(updates.memo).trim() : prevItem.memo,
        timelineAnchor: prevItem.timelineAnchor ?? deriveTimelineAnchorFromTimestamp(prevItem.timestamp),
      };
      const next = prevItems.map((x, j) => (j === idx ? nextItem : x));
      return next;
    });
    if (nextItem) {
      setTimelineByDate((prev) => applyAlbumItemToTimelineSlot(prev, nextItem));
    }
  }, []);

  const deleteAlbumItem = useCallback((id) => {
    setAlbumItems((prevItems) => {
      const item = prevItems.find((x) => x.id === id);
      if (!item) return prevItems;
      setTimelineByDate((prev) => clearAlbumFromTimeline(prev, item));
      return prevItems.filter((x) => x.id !== id);
    });
    setFourSlotIds((prev) => prev.map((sid) => (sid === id ? null : sid)));
  }, []);

  const setFourSlotAt = useCallback((index, albumId) => {
    setFourSlotIds((prev) => {
      const next = [...prev];
      next[index] = albumId;
      return next;
    });
  }, []);

  const clearAllFourSlots = useCallback(() => {
    setFourSlotIds([null, null, null, null]);
  }, []);

  const value = useMemo(
    () => ({
      timelineByDate,
      albumItems,
      fourSlotIds,
      setFourSlotAt,
      clearAllFourSlots,
      moodiDaySummary,
      setMoodiDaySummary,
      selectedDate,
      setSelectedDate,
      shiftSelectedDateByDays,
      applyEmotionForCurrentHour,
      addAlbumItem,
      updateAlbumItem,
      deleteAlbumItem,
    }),
    [
      timelineByDate,
      albumItems,
      fourSlotIds,
      setFourSlotAt,
      clearAllFourSlots,
      moodiDaySummary,
      setMoodiDaySummary,
      selectedDate,
      shiftSelectedDateByDays,
      applyEmotionForCurrentHour,
      addAlbumItem,
      updateAlbumItem,
      deleteAlbumItem,
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
