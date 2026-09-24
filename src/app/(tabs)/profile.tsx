/**
 * Pantalla de Perfil (PRD §8.1).
 *
 * Por ahora contiene la gestión de SESIÓN, que es lo único real que hay:
 *  - Identidad actual (correo de Google, o aviso de sesión sin cuenta).
 *  - Vincular Google si la sesión es anónima. Conserva el `uid`, así que el
 *    historial no se pierde: es la conversión, no un registro desde cero.
 *  - Cerrar sesión, con la advertencia pertinente si es anónima, porque en ese
 *    caso los datos NO se podrán recuperar (no hay credencial con la que volver).
 *
 * Los ajustes del atleta (escala RIR/RPE, unidades) llegarán aquí después.
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/useTheme';
import { linkWithGoogle, SignInCancelledError } from '@/services/auth';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colors, sectionAccent, semantic, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, isAnonymous, signOut } = useAuth();

  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  async function handleLink() {
    setIsLinking(true);
    setLinkError(null);
    try {
      await linkWithGoogle();
    } catch (cause) {
      // Cancelar no es un fallo y no debe mostrar error.
      if (!(cause instanceof SignInCancelledError)) {
        setLinkError(t('auth.signInError'));
      }
    } finally {
      setIsLinking(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 110,
        }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('tabs.profile')}</Text>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.bgElevated, borderRadius: radius.lg, marginTop: spacing.lg },
          ]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
            {t('profile.account').toUpperCase()}
          </Text>

          <Text style={[styles.identity, { color: colors.textPrimary }]}>
            {isAnonymous ? t('auth.anonymousSession') : (user?.email ?? user?.uid ?? '—')}
          </Text>

          {isAnonymous ? (
            <>
              <Text style={[styles.warning, { color: semantic.warning }]}>
                {t('auth.anonymousWarning')}
              </Text>

              {linkError !== null ? (
                <Text style={[styles.error, { color: semantic.danger }]}>{linkError}</Text>
              ) : null}

              <Pressable
                onPress={() => void handleLink()}
                disabled={isLinking}
                accessibilityRole="button"
                accessibilityLabel={t('auth.linkGoogle')}
                style={[
                  styles.primaryButton,
                  { backgroundColor: sectionAccent.train, borderRadius: radius.pill },
                  isLinking && styles.disabled,
                ]}>
                <Text style={styles.primaryLabel}>{t('auth.linkGoogle')}</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        <Pressable
          onPress={() => void signOut()}
          accessibilityRole="button"
          accessibilityLabel={t('auth.signOut')}
          style={[
            styles.signOut,
            { borderColor: colors.surfaceBorder, borderRadius: radius.md, marginTop: spacing.md },
          ]}>
          <Text style={[styles.signOutLabel, { color: semantic.danger }]}>{t('auth.signOut')}</Text>
        </Pressable>

        {/* Advertencia solo cuando cerrar sesión implica pérdida irreversible. */}
        {isAnonymous ? (
          <Text style={[styles.signOutWarning, { color: colors.textMuted }]}>
            {t('profile.signOutAnonymousWarning')}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, paddingTop: 6 },
  card: { padding: 14 },
  cardLabel: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.9 },
  identity: { fontSize: 15, fontWeight: '700', marginTop: 6 },
  warning: { fontSize: 11, lineHeight: 16, marginTop: 10 },
  error: { fontSize: 11, marginTop: 8 },
  primaryButton: { paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  primaryLabel: { fontSize: 14, fontWeight: '800', color: '#16191C' },
  disabled: { opacity: 0.6 },
  signOut: { borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
  signOutLabel: { fontSize: 13, fontWeight: '700' },
  signOutWarning: { fontSize: 10, textAlign: 'center', marginTop: 8, lineHeight: 14 },
});
