import {
  computeTopTwoEmotionIdsFromEntries,
  getEntriesForDate,
  getEntryTimelineHour,
} from '../storage/timelineStateStorage';

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
    return { hour: h, emotionId: repEmotion };
  });

  const n = reps.length;
  const points = reps.map((r, idx) => ({
    emotionId: r.emotionId,
    yValue: emotionYValue(r.emotionId),
    xRatio: n === 1 ? 0.5 : idx / (n - 1),
    hour: r.hour,
    hourLabel: `${String(r.hour).padStart(2, '0')}:00`,
  }));

  return { kind: n === 1 ? 'single' : n === 2 ? 'two' : 'multi', points };
}

const TRIPLE_LINES = new Map(
  [
    ['flutter|gloom|calm', '기대했던 하루였지만 중간에 조금 지쳤고, 결국 괜찮아진 하루'],
    ['annoyed|annoyed|annoyed', '계속해서 답답하고 힘들었던 하루'],
    ['calm|flutter|happy', '차분하게 시작해서 점점 기분이 좋아진 하루'],
    ['calm|happy|happy', '잔잔하게 시작해 기분 좋게 마무리된 하루'],
    ['happy|calm|happy', '한결같이 편안한 기분이 이어진 하루'],
    ['gloom|gloom|gloom', '마음이 계속 무거웠던 하루'],
    ['flutter|flutter|flutter', '들뜬 마음이 끝까지 이어진 하루'],
    ['calm|calm|calm', '조용하고 안정적인 하루'],
    ['happy|happy|happy', '전반적으로 기분이 좋았던 하루'],
    ['annoyed|happy|calm', '시작은 거칠었지만 차츰 나아진 하루'],
    ['gloom|happy|happy', '아침은 무겁지만 점차 밝아진 하루'],
    ['happy|gloom|calm', '좋은 시작 뒤에 잠시 가라앉았다가 안정된 하루'],
    ['flutter|happy|flutter', '기대와 즐거움이 번갈아 찾아온 하루'],
    ['calm|gloom|happy', '잔잔하다가 잠시 가라앉았다가 다시 밝아진 하루'],
    ['annoyed|calm|happy', '답답함이 있었지만 마음이 풀리며 끝난 하루'],
  ].map(([k, v]) => [k, v]),
);

function oneLineSummary(first, dominant, last) {
  if (!first || !dominant || !last) return '감정이 담긴 하루였어요.';
  const key = `${first}|${dominant}|${last}`;
  const exact = TRIPLE_LINES.get(key);
  if (exact) return exact;
  if (first === dominant && dominant === last) {
    const m = {
      annoyed: '한가지 답답함이 길게 이어진 하루',
      gloom: '마음이 가라앉은 기분이 이어진 하루',
      flutter: '설렘이 끝까지 이어진 하루',
      happy: '전반적으로 좋은 기분이 이어진 하루',
      calm: '잔잔한 리듬이 이어진 하루',
    }[first];
    if (m) return m;
  }
  const pos = (id) => id === 'happy' || id === 'flutter';
  const neg = (id) => id === 'gloom' || id === 'annoyed';
  if (pos(first) && neg(dominant) && pos(last)) return '좋게 시작했다가 중간에 흔들렸지만 다시 회복한 하루';
  if (neg(first) && neg(dominant) && pos(last)) return '힘든 시작이 있었지만 마음이 조금 나아진 하루';
  if (pos(first) && pos(dominant) && neg(last)) return '밝게 시작했지만 마무리는 조금 무거웠던 하루';
  if (first === 'calm' && pos(last)) return '차분하게 시작해 기분이 올라간 하루';
  if (pos(first) && last === 'calm') return '기분이 좋았다가 잔잔하게 가라앉은 하루';
  return '여러 감정이 오갔던 하루였어요.';
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
    const memoEntry = pickBestScoredEntry(day, entryMemoScore);
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
