import { useCallback, useMemo } from 'react';
import {
  EMPTY_FOUR,
  VALID_INNER_FRAME_KEYS,
  ensureDayGallery,
} from '../domain/mood/galleryDayState';
import {
  createAlbumItemLinkedToNewEntry,
  entriesAfterAlbumItemDelete,
  entriesWithSyncedAlbumUpdate,
  galleryByDateWithAlbumStrippedFromSlots,
  nextAlbumItemAfterUpdate,
  resolveMoodEntryIdForAlbumItem,
  sortEntriesWithNew,
} from '../domain/mood/galleryEntryLinking';

export function useGalleryByDate({
  entries,
  setEntries,
  albumItems,
  setAlbumItems,
  galleryByDate,
  setGalleryByDate,
  selectedDate,
}) {
  const activeDayGallery = useMemo(
    () => ensureDayGallery(galleryByDate, selectedDate),
    [galleryByDate, selectedDate],
  );

  const fourSlotIds = activeDayGallery.fourSlotIds;
  const moodiDaySummary = activeDayGallery.moodiDaySummary;
  const innerFrameColorKey = activeDayGallery.innerFrameColorKey;

  const addAlbumItem = useCallback(
    ({ imageUri, emotionId, memo }) => {
      const { entry, item } = createAlbumItemLinkedToNewEntry(imageUri, emotionId, memo);
      setEntries((prev) => sortEntriesWithNew(prev, entry));
      setAlbumItems((prev) => [item, ...prev]);
      return item;
    },
    [setEntries, setAlbumItems],
  );

  const updateAlbumItem = useCallback(
    (id, updates) => {
      setAlbumItems((prevItems) => {
        const idx = prevItems.findIndex((x) => x.id === id);
        if (idx < 0) return prevItems;
        const prevItem = prevItems[idx];
        const nextItem = nextAlbumItemAfterUpdate(prevItem, updates);

        setEntries((ent) => {
          const eid = resolveMoodEntryIdForAlbumItem(nextItem, ent);
          return entriesWithSyncedAlbumUpdate(ent, eid, nextItem);
        });

        return prevItems.map((x, j) => (j === idx ? nextItem : x));
      });
    },
    [setAlbumItems, setEntries],
  );

  const deleteAlbumItem = useCallback(
    (albumId) => {
      setAlbumItems((prevItems) => {
        const item = prevItems.find((x) => x.id === albumId);
        if (item) {
          setEntries((prev) => entriesAfterAlbumItemDelete(prev, item));
        }
        return prevItems.filter((x) => x.id !== albumId);
      });
      setGalleryByDate((prev) => galleryByDateWithAlbumStrippedFromSlots(prev, albumId));
    },
    [setAlbumItems, setEntries, setGalleryByDate],
  );

  const setFourSlotAt = useCallback(
    (index, albumId) => {
      setGalleryByDate((prev) => {
        const cur = ensureDayGallery(prev, selectedDate);
        const nextSlots = [...cur.fourSlotIds];
        nextSlots[index] = albumId;
        return { ...prev, [selectedDate]: { ...cur, fourSlotIds: nextSlots } };
      });
    },
    [selectedDate, setGalleryByDate],
  );

  const clearAllFourSlots = useCallback(() => {
    setGalleryByDate((prev) => {
      const cur = ensureDayGallery(prev, selectedDate);
      return { ...prev, [selectedDate]: { ...cur, fourSlotIds: [...EMPTY_FOUR] } };
    });
  }, [selectedDate, setGalleryByDate]);

  const setMoodiDaySummary = useCallback(
    (summary) => {
      const s = typeof summary === 'string' ? summary : '';
      setGalleryByDate((prev) => {
        const cur = ensureDayGallery(prev, selectedDate);
        return { ...prev, [selectedDate]: { ...cur, moodiDaySummary: s } };
      });
    },
    [selectedDate, setGalleryByDate],
  );

  const setInnerFrameColorKey = useCallback(
    (key) => {
      if (typeof key !== 'string' || !VALID_INNER_FRAME_KEYS.has(key)) return;
      setGalleryByDate((prev) => {
        const cur = ensureDayGallery(prev, selectedDate);
        return { ...prev, [selectedDate]: { ...cur, innerFrameColorKey: key } };
      });
    },
    [selectedDate, setGalleryByDate],
  );

  return {
    fourSlotIds,
    moodiDaySummary,
    innerFrameColorKey,
    addAlbumItem,
    updateAlbumItem,
    deleteAlbumItem,
    setFourSlotAt,
    clearAllFourSlots,
    setMoodiDaySummary,
    setInnerFrameColorKey,
  };
}
