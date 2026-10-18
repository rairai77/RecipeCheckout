import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../components/theme';
import { isDemoMode, isMockMode } from '../lib/client/mock';
import { AppStateProvider } from '../lib/client/state';

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
    top: 8,
    right: 8,
    backgroundColor: '#FDE68A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    opacity: 0.9,
  },
  mockText: { fontSize: 11, fontWeight: '800', color: '#78350F', letterSpacing: 0.5 },
});
