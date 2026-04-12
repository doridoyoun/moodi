/**
 * Album rows (`albumItems`) are paired with mood `entries` via `moodEntryId` (preferred) or `createdAt === timestamp` (legacy).
 * Long-term: store photo fields on entries and drop parallel `albumItems` where possible.
 */

import { createMoodEntry, toDateKey } from '../../../storage/timelineStateStorage';
import { ensureDayGallery } from './galleryDayState';

const CHUNKS = 6;

export function deriveTimelineAnchorFromTimestamp(iso) {
  const d = new Date(iso);
  const dateKey = toDateKey(d);
  const hour = d.getHours();
  const chunk = Math.min(CHUNKS - 1, Math.floor(d.getMinutes() / 10));
  return { dateKey, hour, chunk };
}

/**
 * @param {string} imageUri
 * @param {string} emotionId
 * @param {string} memo
 * @returns {{ entry: object, item: object }}
 */
export function createAlbumItemLinkedToNewEntry(imageUri, emotionId, memo) {
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
  return { entry, item };
}

export function sortEntriesWithNew(prev, entry) {
  return [...prev, entry].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/**
 * @param {object} item
 * @param {object[]} entries
 */
export function resolveMoodEntryIdForAlbumItem(item, entries) {
  let eid = item.moodEntryId;
  if (!eid && item.timestamp) {
    eid = entries.find((e) => e.createdAt === item.timestamp)?.id;
  }
  return eid ?? null;
}

/**
 * @param {object} prevItem
 * @param {object} updates
 */
export function nextAlbumItemAfterUpdate(prevItem, updates) {
  return {
    ...prevItem,
    emotionId: updates.emotionId ?? prevItem.emotionId,
    memo: updates.memo !== undefined ? String(updates.memo).trim() : prevItem.memo,
    timelineAnchor: prevItem.timelineAnchor ?? deriveTimelineAnchorFromTimestamp(prevItem.timestamp),
  };
}

/**
 * @param {object[]} entries
 * @param {string|null} eid
 * @param {object} nextItem
 */
export function entriesWithSyncedAlbumUpdate(entries, eid, nextItem) {
  if (!eid) return entries;
  return entries.map((e) => {
    if (e.id !== eid) return e;
    return createMoodEntry({
      id: e.id,
      emotionId: nextItem.emotionId,
      memo: nextItem.memo,
      createdAt: e.createdAt,
    });
  });
}

/**
 * @param {object[]} prevEntries
 * @param {object|undefined} item
 */
export function entriesAfterAlbumItemDelete(prevEntries, item) {
  if (!item) return prevEntries;
  if (item.moodEntryId) {
    return prevEntries.filter((e) => e.id !== item.moodEntryId);
  }
  return prevEntries.filter((e) => e.createdAt !== item.timestamp);
}

/**
 * Clear `albumId` from all days' four-slot arrays.
 * @param {Record<string, unknown>} galleryByDate
 * @param {string} albumId
 */
export function galleryByDateWithAlbumStrippedFromSlots(galleryByDate, albumId) {
  const next = { ...galleryByDate };
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
  return changed ? next : galleryByDate;
}
