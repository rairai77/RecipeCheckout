import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../components/theme';
import { isDemoMode, isMockMode } from '../lib/client/mock';
import { AppStateProvider } from '../lib/client/state';

// Web: load the Google Fonts at runtime (web.output is "single", so there is no +html.tsx to put a <link> in).
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('rc-fonts')) {
  const head = document.head;
  for (const href of ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']) {
    const l = document.createElement('link');
    l.rel = 'preconnect';
    l.href = href;
    if (href.includes('gstatic')) l.crossOrigin = 'anonymous';
    head.appendChild(l);
  }
  const css = document.createElement('link');
  css.id = 'rc-fonts';
  css.rel = 'stylesheet';
  css.href =
    'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500..800;1,9..144,500..800&family=Plus+Jakarta+Sans:wght@400..800&display=swap';
  head.appendChild(css);
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = colors.bg;
  head.appendChild(meta);
  document.body.style.backgroundColor = colors.bg;
}

export default function RootLayout() {
  const badge = isDemoMode() ? 'DEMO REPLAY' : isMockMode() ? 'MOCK DATA' : null;
  return (
    <AppStateProvider>
      <StatusBar style="dark" />
      <View style={styles.root}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            title: 'RecipeCheckout',
          }}
        >
          <Stack.Screen name="index" options={{ title: 'RecipeCheckout' }} />
          <Stack.Screen name="review" options={{ title: 'Review ingredients · RecipeCheckout' }} />
          <Stack.Screen name="results" options={{ title: 'Shopping list · RecipeCheckout' }} />
        </Stack>
        {badge ? (
          <View style={styles.mockBadge} pointerEvents="none">
            <Text style={styles.mockText}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </AppStateProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  mockBadge: {
    position: 'absolute',
    top: 22,
    right: 16,
    backgroundColor: colors.saffronSoft,
    borderWidth: 1,
    borderColor: '#F0D59E',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mockText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '800', color: colors.warn, letterSpacing: 0.6 },
});
