import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'moodi_onboarding_complete_v1';

export async function getHasCompletedOnboarding() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setOnboardingComplete() {
  await AsyncStorage.setItem(KEY, '1');
}
