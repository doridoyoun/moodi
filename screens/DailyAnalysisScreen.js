import { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmotionFlowGraph from '../components/analysis/EmotionFlowGraph';
import EmotionDisplayToken from '../components/timeline/EmotionDisplayToken';
import { useMood } from '../src/context/MoodContext';
import { moodPalette, notebook } from '../constants/theme';
import { computeDailyAnalysis } from '../utils/dailyAnalysis';
import { formatDateKeyForDisplay } from '../storage/timelineStateStorage';
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

  const repPal = analysis?.representativeEmotion
    ? moodPalette[analysis.representativeEmotion]
    : null;

  const memoParts = analysis?.representativeMemo
    ? splitMemo(analysis.representativeMemo)
    : { title: '', content: '' };

  const memoSource = analysis?.representativeMemoSource;

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
          <View style={styles.repCard}>
            <Text style={styles.repSub}>오늘 가장 많이 느낀 감정</Text>
            {analysis.representativeEmotion && repPal ? (
              <View style={styles.repRow}>
                <View style={[styles.repDot, { backgroundColor: repPal.bg, borderColor: repPal.border }]} />
                <View style={styles.repTextCol}>
                  <Text style={[styles.repLabel, { color: repPal.ink }]}>{repPal.label}</Text>
                  <Text style={styles.repCount}>
                    {analysis.representativeEmotionCount}회 · 전체 {analysis.totalEntryCount}개 기록
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>감정 흐름</Text>
            <EmotionFlowGraph flowGraph={analysis.flowGraph} />
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{analysis.oneLineSummary}</Text>
          </View>

          {analysis.representativeMemo && memoSource ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>대표 메모</Text>
              {analysis.usedRepresentativeOverride ? (
                <Text style={styles.overrideHint}>직접 지정한 대표 메모예요</Text>
              ) : null}
              <View style={styles.memoHeader}>
                <EmotionDisplayToken
                  emotionId={memoSource.emotionId}
                  showTime={false}
                  size="sm"
                  compact
                />
                <Text style={styles.memoTime}>{formatEntryTime(memoSource.createdAt)}</Text>
              </View>
              {memoParts.title ? <Text style={styles.memoTitle}>{memoParts.title}</Text> : null}
              {memoParts.content ? (
                <Text style={styles.memoBody}>{memoParts.content}</Text>
              ) : memoParts.title ? null : (
                <Text style={styles.memoBody}>{analysis.representativeMemo.trim()}</Text>
              )}
            </View>
          ) : null}

          {analysis.representativePhotoUri ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>사진</Text>
              <Image
                source={{ uri: analysis.representativePhotoUri }}
                style={styles.photo}
                resizeMode="cover"
                accessibilityLabel="대표 사진"
              />
            </View>
          ) : null}
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
  repCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
  },
  repSub: {
    fontSize: 12,
    fontWeight: '700',
    color: notebook.inkLight,
    marginBottom: 10,
  },
  repRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  repDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
  },
  repTextCol: {
    flex: 1,
    minWidth: 0,
  },
  repLabel: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  repCount: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
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
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: notebook.gridLine,
  },
  summaryText: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '700',
    color: notebook.ink,
    letterSpacing: -0.2,
  },
  overrideHint: {
    fontSize: 12,
    fontWeight: '600',
    color: notebook.inkLight,
    marginBottom: 10,
  },
  memoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  memoTime: {
    fontSize: 13,
    fontWeight: '600',
    color: notebook.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  memoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: notebook.ink,
    marginBottom: 8,
    lineHeight: 24,
  },
  memoBody: {
    fontSize: 15,
    lineHeight: 24,
    color: notebook.ink,
  },
  photo: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: notebook.gridLine,
  },
});
