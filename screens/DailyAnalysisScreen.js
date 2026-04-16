import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmotionFlowGraph from '../components/analysis/EmotionFlowGraph';
import { useMood } from '../src/context/MoodContext';
import { notebook } from '../constants/theme';
import { computeDailyAnalysis } from '../utils/dailyAnalysis';
import { formatDateKeyForDisplay, getEntriesForDate, getEntryTimelineHour } from '../storage/timelineStateStorage';
import { formatEntryTime, splitMemo } from '../utils/timelineEntryFormat';

export default function DailyAnalysisScreen() {
  const insets = useSafeAreaInsets();
  const { entries, selectedDate } = useMood();

  const analysis = useMemo(
    () => computeDailyAnalysis(entries, selectedDate),
    [entries, selectedDate],
  );

  const dateTitle = useMemo(
    () => formatDateKeyForDisplay(selectedDate, 'ko-KR'),
    [selectedDate],
  );

  const dayEntries = useMemo(
    () => getEntriesForDate(entries, selectedDate),
    [entries, selectedDate],
  );

  const daySorted = useMemo(
    () => [...dayEntries].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    [dayEntries],
  );

  const changePointText = useMemo(() => {
    if (daySorted.length < 2) return '감정이 크게 바뀌진 않았어요';

    /** @type {number[]} */
    const hours = [];
    for (let i = 1; i < daySorted.length; i += 1) {
      const prev = daySorted[i - 1];
      const cur = daySorted[i];
      if (prev?.emotionId !== cur?.emotionId) {
        hours.push(getEntryTimelineHour(cur));
      }
    }

    const uniq = [...new Set(hours.filter((h) => Number.isFinite(h)))];
    if (uniq.length === 0) return '감정이 크게 바뀌진 않았어요';
    if (uniq.length === 1) return `${uniq[0]}시에 감정이 바뀌었어요`;
    if (uniq.length <= 3) return `${uniq.slice(0, 3).map((h) => `${h}시`).join(', ')}에 감정이 바뀌었어요`;
    return '감정이 여러 번 바뀐 하루예요';
  }, [daySorted]);

  const concentrationText = useMemo(() => {
    if (daySorted.length === 0) return '기록이 아직 없어요';
    if (daySorted.length === 1) {
      const h = getEntryTimelineHour(daySorted[0]);
      if (h >= 6 && h <= 11) return '아침에 기록이 있었어요';
      if (h >= 12 && h <= 17) return '오후에 기록이 있었어요';
      if (h >= 18 && h <= 23) return '저녁에 기록이 있었어요';
      return '하루 중 한 번 기록이 있었어요';
    }

    /** @type {Record<number, number>} */
    const byHour = {};
    for (const e of daySorted) {
      const h = getEntryTimelineHour(e);
      if (!Number.isFinite(h)) continue;
      byHour[h] = (byHour[h] || 0) + 1;
    }

    // Densest 3-hour window (simple + stable).
    const windowSize = 3;
    let bestStart = 0;
    let bestCount = -1;
    for (let start = 0; start <= 24 - windowSize; start += 1) {
      let c = 0;
      for (let h = start; h < start + windowSize; h += 1) c += byHour[h] || 0;
      if (c > bestCount) {
        bestCount = c;
        bestStart = start;
      }
    }

    if (bestCount >= 3) {
      const end = bestStart + windowSize - 1;
      return `${bestStart}시~${end}시에 기록이 집중되어 있어요`;
    }

    // Fallback broad label (morning / afternoon / evening) using bucket counts.
    const countIn = (from, to) => {
      let c = 0;
      for (let h = from; h <= to; h += 1) c += byHour[h] || 0;
      return c;
    };
    const morning = countIn(6, 11);
    const afternoon = countIn(12, 17);
    const evening = countIn(18, 23);

    const max = Math.max(morning, afternoon, evening);
    if (max <= 1) return '하루 중 띄엄띄엄 기록됐어요';
    if (evening === max) return '저녁에 기록이 많았어요';
    if (afternoon === max) return '오후에 기록이 많았어요';
    return '아침에 기록이 많았어요';
  }, [daySorted]);

  const missedMomentItems = useMemo(() => {
    if (!daySorted.length) return [];

    const rep = analysis?.representativeMemoSource;
    let repId = null;
    if (rep?.createdAt && rep?.memo) {
      const hit = daySorted.find(
        (e) =>
          e.createdAt === rep.createdAt &&
          (e.memo || '').trim() === (rep.memo || '').trim() &&
          (e.emotionId || '') === (rep.emotionId || ''),
      );
      if (hit?.id) repId = hit.id;
    }

    const memoEntries = daySorted.filter((e) => {
      const memo = (e.memo || '').trim();
      if (!memo) return false;
      if (repId && e.id === repId) return false;
      return true;
    });

    const ranked = [...memoEntries].sort((a, b) => {
      const aParts = splitMemo(a.memo || '');
      const bParts = splitMemo(b.memo || '');
      const aHasTitle = (aParts.title || '').trim().length > 0 ? 1 : 0;
      const bHasTitle = (bParts.title || '').trim().length > 0 ? 1 : 0;
      if (bHasTitle !== aHasTitle) return bHasTitle - aHasTitle;

      const aLen = (a.memo || '').trim().length;
      const bLen = (b.memo || '').trim().length;
      if (bLen !== aLen) return bLen - aLen;

      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });

    return ranked.slice(0, 3).map((e) => {
      const parts = splitMemo(e.memo || '');
      const title = (parts.title || '').trim();
      const body = (parts.content || '').trim() || (e.memo || '').trim();
      const firstLine = body.split('\n').map((x) => x.trim()).find(Boolean) || '';
      const titleText = title || (firstLine.length > 36 ? `${firstLine.slice(0, 36).trim()}…` : firstLine) || '메모';
      return {
        id: e.id,
        timeText: formatEntryTime(e.createdAt),
        titleText,
      };
    });
  }, [analysis?.representativeMemoSource, daySorted]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: 28 + Math.max(insets.bottom, 12) }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>하루 요약</Text>
      <Text style={styles.dateLine}>{dateTitle}</Text>

      {!analysis ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>기록이 없어요</Text>
          <Text style={styles.emptySub}>이 날 남긴 감정이 없어 분석할 수 없어요.</Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>감정 흐름</Text>
            <EmotionFlowGraph flowGraph={analysis.flowGraph} />
          </View>

          <View style={styles.insightSection}>
            <Text style={styles.insightLabel}>감정 변화</Text>
            <Text style={styles.insightText}>{changePointText}</Text>
          </View>

          <View style={styles.insightSection}>
            <Text style={styles.insightLabel}>기록이 몰린 시간</Text>
            <Text style={styles.insightText}>{concentrationText}</Text>
          </View>

          <View style={styles.insightSection}>
            <Text style={styles.insightLabel}>놓친 순간 다시 보기</Text>

            {missedMomentItems.length === 0 ? (
              <Text style={styles.missedEmpty}>다시 볼 기록이 아직 없어요</Text>
            ) : (
              missedMomentItems.map((item) => (
                <View key={item.id} style={styles.missedItem}>
                  <Text style={styles.missedTime}>{item.timeText}</Text>
                  <Text style={styles.missedTitle}>{item.titleText}</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: notebook.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: notebook.inkLight,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  dateLine: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '800',
    color: notebook.ink,
    letterSpacing: -0.3,
    marginBottom: 18,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: notebook.ink,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    lineHeight: 21,
    color: notebook.inkMuted,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: notebook.inkMuted,
    marginBottom: 10,
    letterSpacing: -0.1,
  },
  insightSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
  },
  insightLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: notebook.inkMuted,
    marginBottom: 10,
  },
  insightText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: notebook.ink,
  },
  missedItem: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: notebook.gridLine,
  },
  missedTime: {
    fontSize: 12,
    fontWeight: '600',
    color: notebook.inkLight,
    marginBottom: 4,
  },
  missedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: notebook.ink,
    lineHeight: 22,
  },
  missedEmpty: {
    fontSize: 14,
    lineHeight: 22,
    color: notebook.inkLight,
  },
});
