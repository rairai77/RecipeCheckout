import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, MAX_WIDTH, radius, shadow } from './theme';

/** Full-height page: scrollable centered column, optional footer pinned to the bottom. */
export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <View style={styles.page}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>{children}</View>
      </ScrollView>
      {footer ? (
        <View style={styles.footer}>
          <View style={styles.column}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading, style, small }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        variant === 'primary' && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'ghost' && styles.btnGhost,
        pressed && !isDisabled && { opacity: 0.85 },
        isDisabled && styles.btnDisabled,
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={variant === 'primary' ? '#fff' : colors.accent} style={{ marginRight: 8 }} /> : null}
      <Text
        style={[
          styles.btnText,
          small && styles.btnTextSmall,
          variant === 'primary' ? styles.btnTextPrimary : styles.btnTextOther,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxOn]}>
      {checked ? <Text style={styles.checkmark}>✓</Text> : null}
    </View>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'warn'; children: ReactNode }) {
  const bg = tone === 'error' ? colors.dangerSoft : tone === 'warn' ? colors.warnSoft : colors.accentSoft;
  const fg = tone === 'error' ? colors.danger : tone === 'warn' ? colors.warn : colors.accentDark;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <Text style={[styles.noticeText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.back} hitSlop={8}>
      <Text style={styles.backText}>← {label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40, alignItems: 'center' },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 10 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.md,
  },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm },
  btnPrimary: { backgroundColor: colors.accent },
  btnSecondary: { backgroundColor: colors.accentSoft },
  btnGhost: { backgroundColor: 'transparent' },
  btnDisabled: { opacity: 0.55 },
  btnText: { fontSize: 16, fontWeight: '700' },
  btnTextSmall: { fontSize: 14, fontWeight: '600' },
  btnTextPrimary: { color: '#fff' },
  btnTextOther: { color: colors.accentDark },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#B9C6BB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 16 },
  notice: { borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  noticeText: { fontSize: 14, lineHeight: 20 },
  back: { alignSelf: 'flex-start', marginBottom: 12 },
  backText: { color: colors.accentDark, fontSize: 15, fontWeight: '600' },
});
