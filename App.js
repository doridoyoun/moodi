import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainTabs from './navigation/MainTabs';
import OnboardingScreen from './screens/OnboardingScreen';
import { MemoFontProvider } from './src/context/MemoFontContext';
import { MoodProvider } from './src/context/MoodContext';
import { notebook } from './constants/theme';
import { getHasCompletedOnboarding, setOnboardingComplete } from './storage/onboardingStorage';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: notebook.bg,
    card: notebook.bg,
    text: notebook.ink,
    border: notebook.gridLine,
    primary: notebook.ink,
  },
};

const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: notebook.ink,
    background: notebook.bg,
    surface: 'rgba(255,255,255,0.95)',
    outline: notebook.gridLine,
    onSurface: notebook.ink,
  },
};

function AppContent() {
  const [hydrated, setHydrated] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getHasCompletedOnboarding().then((done) => {
      if (!cancelled) {
        setOnboardingDone(done);
        setHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const completeOnboarding = useCallback(async () => {
    await setOnboardingComplete();
    setOnboardingDone(true);
  }, []);

  if (!hydrated) {
    return <View style={{ flex: 1, backgroundColor: notebook.bg }} />;
  }

  if (!onboardingDone) {
    return <OnboardingScreen onComplete={completeOnboarding} />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="dark" />
      <MainTabs />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <MoodProvider>
          <MemoFontProvider>
            <AppContent />
          </MemoFontProvider>
        </MoodProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
