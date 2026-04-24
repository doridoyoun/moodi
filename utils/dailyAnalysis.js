import {
  computeTopTwoEmotionIdsFromEntries,
  getEntriesForDate,
  getEntryTimelineHour,
} from '../storage/timelineStateStorage';
import { moodPalette } from '../constants/theme';

const VALID = new Set(['happy', 'flutter', 'calm', 'gloom', 'annoyed']);

export function normEmotionId(id) {
  return VALID.has(String(id)) ? String(id) : 'happy';
}

/** Hidden Y-axis for flow graph (not shown to user). */
export function emotionYValue(emotionId) {
  const id = normEmotionId(emotionId);
  const map = { happy: 5, flutter: 4, calm: 3, gloom: 2, annoyed: 1 };
  return map[id] ?? 3;
}

function lengthScore(memo) {
  const L = (typeof memo === 'string' ? memo : '').trim().length;
  if (L === 0) return 0;
  if (L < 20) return 0;
  if (L < 50) return 1;
  if (L < 100) return 2;
  return 3;
}

function emotionWeight(emotionId) {
  const id = normEmotionId(emotionId);
  if (id === 'annoyed' || id === 'gloom') return 2;
  if (id === 'flutter') return 1.5;
  if (id === 'happy') return 1;
  if (id === 'calm') return 0.5;
  return 1;
}

function timeWeightForEntry(entry, lastEntryId) {
  const hour = getEntryTimelineHour(entry);
  let w = 0.5;
  if (hour >= 14 && hour <= 20) w += 1;
  if (entry.id === lastEntryId) w += 1.5;
  return w;
}

function entryMemoScore(entry, lastEntryId) {
  const memo = (entry.memo || '').trim();
  if (!memo) return null;
  return (
    lengthScore(entry.memo) + emotionWeight(entry.emotionId) + timeWeightForEntry(entry, lastEntryId)
  );
}

function entryPhotoScore(entry, lastEntryId) {
  const hasPhoto = typeof entry.imageUri === 'string' && entry.imageUri.trim().length > 0;
  if (!hasPhoto) return null;
  return (
    lengthScore(entry.memo) + emotionWeight(entry.emotionId) + timeWeightForEntry(entry, lastEntryId)
  );
}

function pickBestScoredEntry(day, scoreFn) {
  if (!day.length) return null;
  const sorted = [...day].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const lastId = sorted[sorted.length - 1].id;
  let best = null;
  let bestScore = -Infinity;
  for (const e of day) {
    const s = scoreFn(e, lastId);
    if (s == null) continue;
    const t = Date.parse(e.createdAt);
    if (!best || s > bestScore || (s === bestScore && t > Date.parse(best.createdAt))) {
      best = e;
      bestScore = s;
    }
  }
  return best;
}

function pickOverrideEntry(day) {
  const list = day.filter((e) => e.isRepresentativeOverride === true);
  if (!list.length) return null;
  list.sort((a, b) => {
    const tb = Date.parse(
      typeof b.representativeOverrideAt === 'string' ? b.representativeOverrideAt : b.createdAt,
    );
    const ta = Date.parse(
      typeof a.representativeOverrideAt === 'string' ? a.representativeOverrideAt : a.createdAt,
    );
    return tb - ta;
  });
  return list[0];
}

function emotionCounts(day) {
  const counts = {};
  for (const e of day) {
    const id = normEmotionId(e.emotionId);
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

function hasValidMemo(entry) {
  return typeof entry?.memo === 'string' && entry.memo.trim().length > 0;
}

/**
 * Deterministic representative memo selection (source entry) for a day.
 * Steps:
 * 0) pre-filter memo entries; if none => null
 * 1) first emotion change-point entry that has memo
 * 2) longest same-emotion segment => last memo entry in that segment
 * 3) dominant emotion => last memo entry (or longest memo if last is too short)
 * 4) fallback => last memo entry of the day
 * @param {import('../storage/timelineStateStorage').MoodEntry[]} dayEntries
 * @returns {import('../storage/timelineStateStorage').MoodEntry | null}
 */
function pickRepresentativeMemoEntry(dayEntries) {
  const sorted = [...(dayEntries || [])].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const memoEntries = sorted.filter((e) => hasValidMemo(e));
  if (memoEntries.length === 0) return null;

  // Step 1: change-point memo (current emotion differs from previous).
  /** @type {import('../storage/timelineStateStorage').MoodEntry[]} */
  const changeCandidates = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (normEmotionId(cur?.emotionId) !== normEmotionId(prev?.emotionId) && hasValidMemo(cur)) {
      changeCandidates.push(cur);
    }
  }
  if (changeCandidates.length) {
    // Day-level signals for scoring.
    /** @type {Record<string, number>} */
    const dayCounts = {};
    /** @type {Record<string, number>} */
    const dayLastAt = {};
    for (const e of sorted) {
      const id = normEmotionId(e.emotionId);
      dayCounts[id] = (dayCounts[id] || 0) + 1;
      dayLastAt[id] = Date.parse(e.createdAt);
    }
    const dayIds = Object.keys(dayCounts);
    dayIds.sort((a, b) => {
      if ((dayCounts[b] || 0) !== (dayCounts[a] || 0)) return (dayCounts[b] || 0) - (dayCounts[a] || 0);
      return (dayLastAt[b] || 0) - (dayLastAt[a] || 0);
    });
    const dayDominant = dayIds[0] ? normEmotionId(dayIds[0]) : null;

    const n = sorted.length;
    const halfIdx = Math.floor(n / 2);
    const lateHalf = sorted.slice(halfIdx);
    const lateHalfTotal = lateHalf.length || 1;
    const lateHalfNeg = lateHalf.reduce((acc, e) => {
      const id = normEmotionId(e?.emotionId);
      return acc + (id === 'gloom' || id === 'annoyed' ? 1 : 0);
    }, 0);
    const lateHalfIsNegative = lateHalfNeg / lateHalfTotal > 0.5;

    // Candidate scoring: memoLength + laterPositionBonus + dominantMatchBonus + lateNegativeBonus.
    const scoreCandidate = (e) => {
      const memoLength = (e.memo || '').trim().length;
      const idx = sorted.indexOf(e);
      const posRatio = idx >= 0 && n > 1 ? idx / (n - 1) : 0;
      const laterPositionBonus = posRatio * 20;
      const eid = normEmotionId(e.emotionId);
      const dominantMatchBonus = dayDominant && eid === dayDominant ? 16 : 0;
      const lateNegativeBonus = lateHalfIsNegative && (eid === 'gloom' || eid === 'annoyed') ? 14 : 0;
      const laterHalfBonus = idx >= halfIdx ? 10 : 0;
      return memoLength + laterPositionBonus + dominantMatchBonus + lateNegativeBonus + laterHalfBonus;
    };

    let best = changeCandidates[0];
    let bestScore = -Infinity;
    for (const e of changeCandidates) {
      const score = scoreCandidate(e);
      if (
        score > bestScore ||
        (score === bestScore && Date.parse(e.createdAt) > Date.parse(best.createdAt))
      ) {
        best = e;
        bestScore = score;
      }
    }

    // Additional rule: prefer later-half candidate unless earlier memo is much longer.
    const laterHalfCandidates = changeCandidates.filter((e) => sorted.indexOf(e) >= halfIdx);
    if (laterHalfCandidates.length) {
      let bestLate = laterHalfCandidates[0];
      let bestLateScore = -Infinity;
      for (const e of laterHalfCandidates) {
        const s = scoreCandidate(e);
        if (s > bestLateScore || (s === bestLateScore && Date.parse(e.createdAt) > Date.parse(bestLate.createdAt))) {
          bestLate = e;
          bestLateScore = s;
        }
      }

      const bestIdx = sorted.indexOf(best);
      if (bestIdx >= 0 && bestIdx < halfIdx) {
        const earlyLen = (best.memo || '').trim().length;
        const lateLen = (bestLate.memo || '').trim().length;
        if (!(earlyLen >= lateLen + 30)) {
          return bestLate;
        }
      }
    }

    return best;
  }

  // Step 2: longest consecutive same-emotion segment.
  /** @type {{ start: number, end: number, len: number, emotionId: string } | null} */
  let bestSeg = null;
  let segStart = 0;
  for (let i = 1; i <= sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const prevId = prev ? normEmotionId(prev.emotionId) : 'happy';
    const curId = i < sorted.length ? normEmotionId(sorted[i].emotionId) : null;
    const boundary = i === sorted.length || curId !== prevId;
    if (boundary) {
      const segEnd = i - 1;
      const len = segEnd - segStart + 1;
      if (!bestSeg || len > bestSeg.len) {
        bestSeg = { start: segStart, end: segEnd, len, emotionId: prevId };
      }
      segStart = i;
    }
  }

  if (bestSeg) {
    const seg = sorted.slice(bestSeg.start, bestSeg.end + 1);
    for (let i = seg.length - 1; i >= 0; i -= 1) {
      if (hasValidMemo(seg[i])) return seg[i];
    }
  }

  // Step 3: dominant emotion group.
  /** @type {Record<string, number>} */
  const counts = {};
  /** @type {Record<string, number>} */
  const lastAt = {};
  for (const e of sorted) {
    const id = normEmotionId(e.emotionId);
    counts[id] = (counts[id] || 0) + 1;
    lastAt[id] = Date.parse(e.createdAt);
  }
  const ids = Object.keys(counts);
  ids.sort((a, b) => {
    if ((counts[b] || 0) !== (counts[a] || 0)) return (counts[b] || 0) - (counts[a] || 0);
    return (lastAt[b] || 0) - (lastAt[a] || 0);
  });
  const dominantId = ids[0] ? normEmotionId(ids[0]) : null;
  if (dominantId) {
    const domMemo = sorted.filter((e) => normEmotionId(e.emotionId) === dominantId && hasValidMemo(e));
    if (domMemo.length) {
      const last = domMemo[domMemo.length - 1];
      const lastLen = (last.memo || '').length;
      if (lastLen >= 10) return last;

      let best = last;
      let bestLen = lastLen;
      for (const e of domMemo) {
        const L = (e.memo || '').length;
        const t = Date.parse(e.createdAt);
        if (L > bestLen || (L === bestLen && t > Date.parse(best.createdAt))) {
          best = e;
          bestLen = L;
        }
      }
      return best;
    }
  }

  // Step 4: final fallback => last memo entry in the day.
  return memoEntries[memoEntries.length - 1];
}

/**
 * @param {import('../storage/timelineStateStorage').MoodEntry[]} dayEntries
 * @returns {{ kind: 'single' | 'two' | 'multi', points: { emotionId: string, yValue: number, xRatio: number, hour: number, hourLabel: string }[] }}
 */
export function buildFlowGraphPayload(dayEntries) {
  const sorted = [...dayEntries].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  if (sorted.length === 0) return { kind: 'single', points: [] };

  // 1-hour segmentation: each hour becomes one representative point.
  /** @type {Record<number, import('../storage/timelineStateStorage').MoodEntry[]>} */
  const byHour = {};
  for (const e of sorted) {
    const h = getEntryTimelineHour(e);
    if (!byHour[h]) byHour[h] = [];
    byHour[h].push(e);
  }

  const hours = Object.keys(byHour)
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x))
    .sort((a, b) => a - b);

  const reps = hours.map((h) => {
    const list = [...byHour[h]].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const counts = {};
    const lastAt = {};
    for (const e of list) {
      const id = normEmotionId(e.emotionId);
      counts[id] = (counts[id] || 0) + 1;
      lastAt[id] = Date.parse(e.createdAt);
    }
    const ids = Object.keys(counts);
    ids.sort((a, b) => {
      if (counts[b] !== counts[a]) return counts[b] - counts[a];
      return (lastAt[b] || 0) - (lastAt[a] || 0);
    });
    const repEmotion = ids[0] ? normEmotionId(ids[0]) : 'happy';
    return { hour: h, emotionId: repEmotion, count: list.length };
  });

  const n = reps.length;
  const points = reps.map((r, idx) => ({
    emotionId: r.emotionId,
    yValue: emotionYValue(r.emotionId),
    xRatio: n === 1 ? 0.5 : idx / (n - 1),
    hour: r.hour,
    hourLabel: `${String(r.hour).padStart(2, '0')}:00`,
    count: r.count,
  }));

  return { kind: n === 1 ? 'single' : n === 2 ? 'two' : 'multi', points };
}

const TRIPLE_LINES = new Map(
  [
    ['flutter|gloom|calm', '기대했던 하루였지만 중간에 조금 지쳤고, 결국 괜찮아진 하루'],
    ['annoyed|annoyed|annoyed', '계속해서 답답하고 힘들었던 하루'],
    ['calm|flutter|happy', '차분하게 시작해서 점점 기분이 좋아진 하루'],
    ['calm|happy|happy', '평온하게 시작해 기분 좋게 마무리된 하루'],
    ['happy|calm|happy', '한결같이 편안한 기분이 이어진 하루'],
    ['gloom|gloom|gloom', '마음이 계속 무거웠던 하루'],
    ['flutter|flutter|flutter', '들뜬 마음이 끝까지 이어진 하루'],
    ['calm|calm|calm', '조용하고 안정적인 하루'],
    ['happy|happy|happy', '전반적으로 기분이 좋았던 하루'],
    ['annoyed|happy|calm', '시작은 거칠었지만 차츰 나아진 하루'],
    ['gloom|happy|happy', '아침은 무겁지만 점차 밝아진 하루'],
    ['happy|gloom|calm', '좋은 시작 뒤에 잠시 가라앉았다가 안정된 하루'],
    ['flutter|happy|flutter', '기대와 즐거움이 번갈아 찾아온 하루'],
    ['calm|gloom|happy', '평온하다가 잠시 가라앉았다가 다시 밝아진 하루'],
    ['annoyed|calm|happy', '답답함이 있었지만 마음이 풀리며 끝난 하루'],
  ].map(([k, v]) => [k, v]),
);

function oneLineSummary(first, dominant, last) {
  /** @type {number | null} */
  const entryUniqCount =
    typeof oneLineSummary.entryUniqCount === 'number' ? oneLineSummary.entryUniqCount : null;
  /** @type {number | null} */
  const changeCount = typeof oneLineSummary.changeCount === 'number' ? oneLineSummary.changeCount : null;
  /** @type {string | null} */
  const dominantEntryEmotionId =
    typeof oneLineSummary.dominantEntryEmotionId === 'string' ? oneLineSummary.dominantEntryEmotionId : null;
  /** @type {number | null} */
  const dominantEntryRatio =
    typeof oneLineSummary.dominantEntryRatio === 'number' ? oneLineSummary.dominantEntryRatio : null;
  /** @type {string | null} */
  const lastEntryEmotionId =
    typeof oneLineSummary.lastEntryEmotionId === 'string' ? oneLineSummary.lastEntryEmotionId : null;

  const firstId = first ? normEmotionId(first) : null;
  const lastId = last ? normEmotionId(last) : null;
  const domId = dominant ? normEmotionId(dominant) : null;

  const uniq =
    entryUniqCount ?? new Set([firstId, domId, lastId].filter(Boolean)).size;

  const emotionLabel = (id) => {
    const nid = id ? normEmotionId(id) : null;
    return nid && moodPalette[nid] ? moodPalette[nid].label : '감정';
  };

  // 1) Single emotion (highest priority)
  if (uniq === 1) {
    const onlyId = dominantEntryEmotionId || domId || firstId || lastId || lastEntryEmotionId;
    const oid = onlyId ? normEmotionId(onlyId) : null;
    if (oid === 'happy') return '기분 좋은 순간이 이어졌어요';
    if (oid === 'flutter') return '설렘이 이어진 하루였어요';
    if (oid === 'calm') return '평온하게 이어진 하루였어요';
    if (oid === 'gloom') return '마음이 조금 가라앉아 있던 하루였어요';
    if (oid === 'annoyed') return '짜증이 이어진 하루였어요';
    return '평온한 하루였어요';
  }

  // 2) Emotional fluctuation (before mixed / dominant tail)
  if (changeCount != null && changeCount >= 2) return '감정 기복이 큰 하루였어요';

  // 3) Dominant emotion
  if (dominantEntryRatio != null && dominantEntryRatio >= 0.5 && dominantEntryEmotionId) {
    return `${emotionLabel(dominantEntryEmotionId)}이 가장 많이 남아 있는 하루예요`;
  }

  // 4) Mixed emotions
  if (uniq >= 2) return '여러 감정이 함께 남아 있는 하루예요';

  // 5) Ending emotion (fallback only)
  const endId = lastEntryEmotionId || lastId;
  if (endId) return `마지막엔 ${emotionLabel(endId)}이 느껴졌어요`;

  return '평온한 하루였어요';
}

function dominantEmotionFromPoints(points) {
  if (!points.length) return null;
  const counts = {};
  const lastIdx = {};
  points.forEach((p, i) => {
    const id = normEmotionId(p.emotionId);
    counts[id] = (counts[id] || 0) + 1;
    lastIdx[id] = i;
  });
  const ids = Object.keys(counts);
  ids.sort((a, b) => {
    if (counts[b] !== counts[a]) return counts[b] - counts[a];
    return (lastIdx[b] ?? 0) - (lastIdx[a] ?? 0);
  });
  return ids[0] ? normEmotionId(ids[0]) : null;
}

/**
 * @param {import('../storage/timelineStateStorage').MoodEntry[]} entries
 * @param {string} dateKey
 */
export function computeDailyAnalysis(entries, dateKey) {
  const day = getEntriesForDate(entries, dateKey);
  if (!day.length) return null;

  const sortedDay = [...day].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  const topTwo = computeTopTwoEmotionIdsFromEntries(entries, dateKey);
  const representativeEmotion = topTwo[0] ? normEmotionId(topTwo[0]) : null;
  const counts = emotionCounts(day);
  const representativeEmotionCount = representativeEmotion ? counts[representativeEmotion] ?? 0 : 0;
  const totalEntryCount = day.length;

  const overrideEntry = pickOverrideEntry(day);
  const usedRepresentativeOverride = overrideEntry != null;

  let representativeMemo = null;
  let representativePhotoUri = null;
  /** @type {{ emotionId: string, createdAt: string, memo: string } | null} */
  let representativeMemoSource = null;

  if (overrideEntry) {
    const m = (overrideEntry.memo || '').trim();
    representativeMemo = m.length ? overrideEntry.memo : null;
    const ph =
      typeof overrideEntry.imageUri === 'string' && overrideEntry.imageUri.trim().length > 0
        ? overrideEntry.imageUri.trim()
        : null;
    representativePhotoUri = ph;
    if (representativeMemo) {
      representativeMemoSource = {
        emotionId: normEmotionId(overrideEntry.emotionId),
        createdAt: overrideEntry.createdAt,
        memo: overrideEntry.memo,
      };
    }
  } else {
    const memoEntry = pickRepresentativeMemoEntry(day);
    if (memoEntry) {
      representativeMemo = memoEntry.memo;
      representativeMemoSource = {
        emotionId: normEmotionId(memoEntry.emotionId),
        createdAt: memoEntry.createdAt,
        memo: memoEntry.memo,
      };
      const ph =
        typeof memoEntry.imageUri === 'string' && memoEntry.imageUri.trim().length > 0
          ? memoEntry.imageUri.trim()
          : null;
      representativePhotoUri = ph;
    }
    if (!representativePhotoUri) {
      const photoEntry = pickBestScoredEntry(day, entryPhotoScore);
      if (photoEntry?.imageUri?.trim()) {
        representativePhotoUri = photoEntry.imageUri.trim();
      }
    }
  }

  const flowGraph = buildFlowGraphPayload(day);
  const pts = flowGraph.points;
  const firstFlow = pts.length ? normEmotionId(pts[0].emotionId) : null;
  const lastFlow = pts.length ? normEmotionId(pts[pts.length - 1].emotionId) : null;
  const dominantFlow = dominantEmotionFromPoints(pts) || representativeEmotion || firstFlow;

  const entryUniqCount = Object.keys(counts).length;
  let changeCount = 0;
  for (let i = 1; i < sortedDay.length; i += 1) {
    if (normEmotionId(sortedDay[i]?.emotionId) !== normEmotionId(sortedDay[i - 1]?.emotionId)) {
      changeCount += 1;
    }
  }

  let dominantEntryEmotionId = null;
  let dominantEntryRatio = 0;
  if (totalEntryCount > 0) {
    /** @type {Record<string, number>} */
    const lastIdxById = {};
    for (let i = 0; i < sortedDay.length; i += 1) {
      const id = normEmotionId(sortedDay[i]?.emotionId);
      lastIdxById[id] = i;
    }

    const ids = Object.keys(counts);
    ids.sort((a, b) => {
      if ((counts[b] || 0) !== (counts[a] || 0)) return (counts[b] || 0) - (counts[a] || 0);
      const la = lastIdxById[normEmotionId(a)] ?? -1;
      const lb = lastIdxById[normEmotionId(b)] ?? -1;
      return lb - la;
    });
    dominantEntryEmotionId = ids[0] ? normEmotionId(ids[0]) : null;
    dominantEntryRatio =
      dominantEntryEmotionId != null ? (counts[dominantEntryEmotionId] ?? 0) / totalEntryCount : 0;
  }

  const lastEntryEmotionId = sortedDay.length
    ? normEmotionId(sortedDay[sortedDay.length - 1]?.emotionId)
    : null;

  oneLineSummary.entryUniqCount = entryUniqCount;
  oneLineSummary.changeCount = changeCount;
  oneLineSummary.dominantEntryEmotionId = dominantEntryEmotionId;
  oneLineSummary.dominantEntryRatio = dominantEntryRatio;
  oneLineSummary.lastEntryEmotionId = lastEntryEmotionId;

  const summary = oneLineSummary(firstFlow, dominantFlow, lastFlow);

  return {
    dateKey,
    representativeEmotion,
    representativeEmotionCount,
    totalEntryCount,
    representativeMemo,
    representativePhotoUri,
    representativeMemoSource,
    usedRepresentativeOverride,
    flowGraph,
    oneLineSummary: summary,
  };
}
