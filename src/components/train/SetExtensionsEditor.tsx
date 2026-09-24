/**
 * Editor de tramos extra para series avanzadas (PRD §8.8).
 *
 * Aparece INMEDIATAMENTE al elegir Drop Set, Rest Pause o Myo-Rep. No es un
 * resumen: son los parámetros que el atleta escribe durante la sesión.
 *
 *  - Drop Set: cada tramo pide REPETICIONES y KG propios.
 *  - Rest Pause / Myo-Rep: solo pide REPETICIONES; el peso se hereda de la
 *    serie principal y se muestra como texto para que quede explícito.
 *
 * Los inputs empiezan vacíos (`reps: undefined`), nunca en 0: rellenar con 0
 * inventaría trabajo que el atleta no ha hecho.
 */
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SetType, type SetExtension } from '@/models';
import { useTheme } from '@/theme/useTheme';
import { NumericField } from './NumericField';

interface SetExtensionsEditorProps {
  setType: SetType;
  extensions: SetExtension[];
  mainWeight: number | undefined;
  editable: boolean;
  onChange: (extensions: SetExtension[]) => void;
}

export function SetExtensionsEditor({
  setType,
  extensions,
  mainWeight,
  editable,
  onChange,
}: SetExtensionsEditorProps) {
  const { t } = useTranslation();
  const { colors, sectionAccent, radius, spacing } = useTheme();
  const requiresWeight = setType === SetType.DROP_SET;

  function update(index: number, patch: Partial<SetExtension>) {
    onChange(extensions.map((extension, current) => (current === index ? { ...extension, ...patch } : extension)));
  }

  function remove(index: number) {
    onChange(extensions.filter((_, current) => current !== index));
  }

  return (
    <View style={[styles.container, { borderLeftColor: `${sectionAccent.train}66` }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{t('train.extraSets')}</Text>
        {!requiresWeight ? (
          <Text style={[styles.inheritedWeight, { color: colors.textMuted }]}>
            {t('train.sameWeight', { weight: mainWeight ?? '—' })}
          </Text>
        ) : null}
      </View>

      {extensions.map((extension, index) => (
        <View key={index} style={styles.extensionRow}>
          <Text style={[styles.index, { color: colors.textMuted }]}>{index + 1}</Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('train.reps')}</Text>
            <View style={styles.field}>
              <NumericField
                value={extension.reps}
                onChangeValue={(reps) => update(index, { reps })}
                editable={editable}
                accessibilityLabel={`${t('train.extension')} ${index + 1} ${t('train.reps')}`}
              />
            </View>
          </View>

          {requiresWeight ? (
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('train.weight')}</Text>
              <View style={styles.field}>
                <NumericField
                  value={extension.weight}
                  onChangeValue={(weight) => update(index, { weight })}
                  decimal
                  editable={editable}
                  accessibilityLabel={`${t('train.extension')} ${index + 1} ${t('train.weight')}`}
                />
              </View>
            </View>
          ) : null}

          {editable ? (
            <Pressable
              onPress={() => remove(index)}
              accessibilityRole="button"
              accessibilityLabel={t('train.removeExtension')}
              style={[styles.remove, { borderColor: colors.surfaceBorder, borderRadius: radius.sm }]}>
              <Text style={[styles.removeText, { color: colors.textMuted }]}>×</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      {editable ? (
        <Pressable
          onPress={() => onChange([...extensions, {}])}
          accessibilityRole="button"
          accessibilityLabel={t('train.addExtension')}
          style={[styles.add, { borderColor: colors.surfaceBorder, borderRadius: radius.sm, marginTop: spacing.xs }]}>
          <Text style={[styles.addText, { color: colors.textSecondary }]}>+ {t('train.addExtension')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginLeft: 52, marginRight: 16, marginBottom: 8, borderLeftWidth: 2, paddingLeft: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  label: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  inheritedWeight: { fontSize: 9 },
  extensionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginBottom: 6 },
  index: { width: 13, fontSize: 10, fontWeight: '700', paddingBottom: 8 },
  fieldGroup: { gap: 3 },
  fieldLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  field: { width: 54, alignItems: 'center' },
  remove: { width: 28, height: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  removeText: { fontSize: 18, lineHeight: 20, fontWeight: '400' },
  add: { alignSelf: 'flex-start', borderWidth: 1, borderStyle: 'dashed', paddingHorizontal: 9, paddingVertical: 5 },
  addText: { fontSize: 10, fontWeight: '600' },
});
