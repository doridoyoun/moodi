/**
 * Legacy compatibility: entry list → old `timelineByDate` (hour/chunk grid) for screens that still consume that shape.
 * Long-term: render from `entries` only and delete this bridge + `timelineByDate` from context.
 * Implementation lives in timeline storage for now; this module isolates the dependency for callers.
 *
 * @see ../../../storage/timelineStateStorage.js — `buildLegacyTimelineByDateFromEntries`
 */

export { buildLegacyTimelineByDateFromEntries } from '../../../storage/timelineStateStorage';
