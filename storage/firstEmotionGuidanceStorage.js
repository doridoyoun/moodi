import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'moodi_first_emotion_recorded_v1';

/**
 * First-time guidance: show until user records at least one emotion via quick input.
 * If entries already exist (upgrade / restore), treat as done without showing guidance.
 */
export async function shouldShowFirstEmotionGuidance(entriesLength) {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === '1') return false;
    if (entriesLength > 0) {
      await AsyncStorage.setItem(KEY, '1');
      return false;
    }
    return true;
  } catch {
    return entriesLength === 0;
  }
}

export async function markFirstEmotionRecorded() {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}
