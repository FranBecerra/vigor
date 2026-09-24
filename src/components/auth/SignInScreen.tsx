/**
 * Pantalla de acceso (PRD §8.1).
 *
 * Jerarquía deliberada:
 *  - **Google**: acción primaria, botón sólido. Es la vía recomendada porque
 *    deja una cuenta recuperable: borrar la app no pierde el historial.
 *  - **Probar sin cuenta**: secundaria y discreta, con su coste declarado. No se
 *    esconde —permite entrenar sin fricción— pero tampoco se presenta como la
 *    opción natural, porque una sesión anónima solo vive en ese dispositivo.
 *
 * No hay botón de Apple todavía: requiere la capability que necesita cuenta de
 * pago. Cuando esté, entra aquí como segunda acción primaria (y será obligatorio
 * para publicar, por la directriz 4.8 de la App Store).
 */
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { DumbbellIcon } from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/useTheme';

export function SignInScreen() {
  const { t } = useTranslation();
  const { colors, sectionAccent, semantic, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, continueWithoutAccount, isSigningIn, error } = useAuth();

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top + spacing.xxl,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}>
      <View style={styles.brand}>
        <View style={[styles.mark, { backgroundColor: sectionAccent.train, borderRadius: radius.lg }]}>
          <DumbbellIcon size={34} color="#16191C" />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Vigor</Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>{t('auth.tagline')}</Text>
      </View>

      <View style={styles.actions}>
        {error !== null ? (
          <View
            style={[
              styles.errorBox,
              { borderColor: semantic.warning, borderRadius: radius.md },
            ]}>
            <Text style={[styles.errorText, { color: semantic.warning }]}>
              {t('auth.signInError')}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => void signInWithGoogle()}
          disabled={isSigningIn}
          accessibilityRole="button"
          accessibilityLabel={t('auth.continueWithGoogle')}
          accessibilityState={{ disabled: isSigningIn }}
          style={[
            styles.primaryButton,
            { backgroundColor: sectionAccent.train, borderRadius: radius.pill },
            isSigningIn && styles.disabled,
          ]}>
          {isSigningIn ? (
            <ActivityIndicator color="#16191C" />
          ) : (
            <Text style={styles.primaryLabel}>{t('auth.continueWithGoogle')}</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => void continueWithoutAccount()}
          disabled={isSigningIn}
          accessibilityRole="button"
          accessibilityLabel={t('auth.continueWithoutAccount')}
          style={styles.secondaryButton}>
          <Text style={[styles.secondaryLabel, { color: colors.textSecondary }]}>
            {t('auth.continueWithoutAccount')}
          </Text>
        </Pressable>

        {/* El coste de la opción anónima se declara, no se esconde. */}
        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          {t('auth.anonymousWarning')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 28 },
  brand: { alignItems: 'center', marginTop: 48 },
  mark: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8, marginTop: 18 },
  tagline: { fontSize: 13, marginTop: 6, textAlign: 'center' },
  actions: { gap: 14 },
  errorBox: { borderWidth: 1, padding: 11 },
  errorText: { fontSize: 11.5, textAlign: 'center' },
  primaryButton: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  primaryLabel: { fontSize: 15, fontWeight: '800', color: '#16191C' },
  disabled: { opacity: 0.6 },
  secondaryButton: { paddingVertical: 11, alignItems: 'center' },
  secondaryLabel: { fontSize: 13, fontWeight: '600' },
  disclaimer: { fontSize: 10.5, textAlign: 'center', lineHeight: 15 },
});
