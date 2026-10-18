import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../components/theme';
import { isCleanMode, isDemoMode, isMockMode } from '../lib/client/mock';
import { AppStateProvider, useAppState } from '../lib/client/state';

// The home page is dark (produce-aisle art); every other page is cream.
const HOME_BG = '#0C0D0B';

// Web: fonts, description, Open Graph tags and the first-paint background live in public/index.html.
// Fallback for dev servers that don't use that template: load the fonts at runtime.
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('rc-fonts')) {
  const css = document.createElement('link');
  css.id = 'rc-fonts';
  css.rel = 'stylesheet';
  css.href =
    'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500..800;1,9..144,500..800&family=Plus+Jakarta+Sans:wght@400..800&display=swap';
  document.head.appendChild(css);
}

/** Keep the page background and browser theme colour in step with the route, so overscroll and the gap before
 *  a screen paints are never a mismatched (white or cream) flash. */
function useDocumentTheme() {
  const pathname = usePathname();
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const bg = pathname === '/' ? HOME_BG : colors.bg;
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', bg);
  }, [pathname]);
}

/** DEMO REPLAY / MOCK DATA badge. Reads app state so it appears as soon as "See a sample run" turns the replay on. */
function ModeBadge() {
  useAppState();
  const badge = isCleanMode() ? null : isDemoMode() ? 'DEMO REPLAY' : isMockMode() ? 'MOCK DATA' : null;
  if (!badge) return null;
  return (
    <View style={styles.mockBadge} pointerEvents="none">
      <Text style={styles.mockText}>{badge}</Text>
    </View>
  );
}

export default function RootLayout() {
  useDocumentTheme();
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
          <Stack.Screen name="index" options={{ title: 'RecipeCheckout · Any recipe, sorted by aisle', contentStyle: { backgroundColor: HOME_BG } }} />
          <Stack.Screen name="review" options={{ title: 'Review ingredients · RecipeCheckout' }} />
          <Stack.Screen name="results" options={{ title: 'Shopping list · RecipeCheckout' }} />
          <Stack.Screen name="+not-found" options={{ title: 'RecipeCheckout' }} />
        </Stack>
        <ModeBadge />
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
