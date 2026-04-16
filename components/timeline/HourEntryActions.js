import { Pressable, StyleSheet, Text, View } from 'react-native';
import { notebook } from '../../constants/theme';

export default function HourEntryActions({
  entryCount,
  memoCount,
  inspectOpen,
  inspectMode,
  onPressEmotion,
  onPressMemo,
}) {
  const emotionActive = inspectOpen && inspectMode === 'emotion';
  const memoActive = inspectOpen && inspectMode === 'memo';

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPressEmotion}
        style={styles.hit}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`감정 흐름 보기, ${entryCount}건`}
      >
        <Text style={[styles.label, emotionActive && styles.labelActive]}>
          {emotionActive ? `감정 흐름 (${entryCount}) ▲` : `감정 흐름 (${entryCount}) ▼`}
        </Text>
      </Pressable>
      <Text style={styles.sep}>·</Text>
      <Pressable
        onPress={onPressMemo}
        style={styles.hit}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`메모 모아보기, ${memoCount}건`}
      >
        <Text style={[styles.label, memoActive && styles.labelActive]}>
          {memoActive ? `메모 모아보기 (${memoCount}) ▲` : `메모 모아보기 (${memoCount}) ▼`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  hit: {
    paddingVertical: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: notebook.inkMuted,
  },
  labelActive: {
    color: notebook.ink,
  },
  sep: {
    fontSize: 12,
    color: notebook.inkLight,
    fontWeight: '600',
  },
});
