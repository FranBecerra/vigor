import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { ACCENTS } from '@/theme/accent';
import { RoutineBadgeIcon } from '@/components/icons/RoutineBadgeIcon';
import { RoutineDayIndicator } from '@/components/home/RoutineDayIndicator';
import { CardioHeartIcon } from '@/components/icons/CycleReviewIcons';
import { canReorderAgendaPosition, pendingAgendaSession, type AgendaEntry, type trainingAgenda } from '@/services/training/trainingAgenda';
import { SwipeableSet } from './SwipeableSet';
import { RoutineDayList, type DayListScroll } from './RoutineDayList';
import { cardioSlotPrescription } from '@/services/cardio/cardioProgressionPolicy';

export function AgendaBadge({ entry }: { entry: AgendaEntry }) {
  const { colors, scheme } = useTheme();
  if (entry.kind === 'rest') return <RoutineDayIndicator kind="rest" completed={entry.checked} />;
  if (entry.kind === 'strength' && (entry.session.completedOn || entry.session.skippedOn)) return <RoutineDayIndicator completed />;
  if (entry.kind === 'cardio' && (entry.session.completed || entry.session.slot.disposition === 'SKIPPED')) return <RoutineDayIndicator kind="cardio" completed />;
  return <View accessible={false} style={{ width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center',
    backgroundColor: entry.kind !== 'strength' ? (scheme === 'light' ? ACCENTS.sky.tintLight : ACCENTS.sky.tintDark) : colors.accentTint }}>
    {entry.kind !== 'strength' ? <CardioHeartIcon color={ACCENTS.sky[scheme]} size={18} />
      : <RoutineBadgeIcon icon={entry.routine.icon} size={19} />}
  </View>;
}

export function TrainingAgenda({ agenda, onOpen, onLink, canMove, canLink, onToggleRest, onRemoveRest, onReorder, onAccessibleMove, onAddRest, edgeScroll }: {
  agenda: ReturnType<typeof trainingAgenda>;
  onOpen(entry: AgendaEntry): void; onLink(entry: AgendaEntry): void;
  onReorder(from: number, to: number): void;
  onAccessibleMove?(id: string, direction: -1 | 1): void;
  onAddRest?(): void;
  edgeScroll?: DayListScroll;
  canMove(entry: AgendaEntry): boolean; canLink(entry: AgendaEntry): boolean;
  onRemoveRest?(entry: Extract<AgendaEntry, { kind: 'rest' }>): boolean | void;
  onToggleRest?(entry: Extract<AgendaEntry, { kind: 'rest' }>): void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, surfaces, radius, scheme } = useTheme();
  const { fontScale } = useWindowDimensions();
  if (!agenda.rows.length) return null;
  const indexes = new Map(agenda.rows.map((entry, index) => [entry.id, index]));
  const groups = new Map<string | undefined, AgendaEntry[]>();
  const nextByGroup = new Map<string | undefined, number>();
  agenda.rows.forEach((entry, index) => {
    if (!groups.has(entry.group)) groups.set(entry.group, []);
    groups.get(entry.group)!.push(entry);
    if (!nextByGroup.has(entry.group) && pendingAgendaSession(entry)) nextByGroup.set(entry.group, index);
  });
  const canDrop = (entry: AgendaEntry, from: number, to: number) => canMove(entry)
    && entry.group === agenda.rows[from].group
    && canReorderAgendaPosition(agenda.rows[from], nextByGroup.get(entry.group) ?? -1, from, to);
  const canMoveInDirection = (index: number, direction: -1 | 1) => agenda.rows.some((target, to) =>
    Math.sign(to - index) === direction && canDrop(target, index, to));

  const row = (entry: AgendaEntry) => {
    const cardio = entry.kind === 'cardio' ? entry.session : null;
    const prescription = cardio && (cardio.workout?.prescription ?? cardioSlotPrescription(cardio.block, cardio.slot.id));
    const sport = entry.kind === 'sport' ? entry.sport : entry.kind === 'cardio' ? entry.sport : undefined;
    const name = sport ? sport.name || t(`sportActivities.sports.${sport.sport}`)
      : entry.kind === 'strength' ? entry.session.name : prescription ? t(`cardioPlan.${prescription.modality}`) : t('calendar.rest');
    const details = entry.kind === 'strength' ? [entry.routine.name, `${entry.sets} ${t('home.sets')}`, entry.session.skippedOn ? t('routine.skipped') : '']
      : cardio ? [cardio.block.proposal.name, cardio.seconds ? `${Math.round(cardio.seconds / 6) / 10} min` : t('manualCardio.untimed'),
        cardio.workout?.source === 'APPLE_HEALTH_LINK_V1' ? t('trainingAgenda.healthSource') : cardio.slot.disposition === 'SKIPPED'
          ? t('cardioTraining.skipped') : cardio.slot.disposition === 'SPORT' ? t(cardio.resolved ? 'cardioTraining.sportRecorded' : 'cardioTraining.sportReserved') : ''] : [];
    if ('date' in entry && entry.date) details.unshift(new Date(`${entry.date}T12:00:00`).toLocaleDateString(i18n.language,
      { weekday: 'short', day: 'numeric', month: 'short' }));
    const next = entry.id === agenda.nextId;
    const skipped = entry.kind === 'strength' ? !!entry.session.skippedOn : cardio?.slot.disposition === 'SKIPPED';
    const index = indexes.get(entry.id)!;
    const movable = canMove(entry);
    const remove = entry.kind === 'rest' && onRemoveRest ? () => onRemoveRest(entry) : undefined;
    const actions = [
      ...(remove ? [{ name: 'removeRest', label: t('restDays.remove') }] : []),
      ...(movable && onAccessibleMove ? [
      ...(canMoveInDirection(index, -1) ? [{ name: 'moveEarlier', label: t('trainingAgenda.earlier') }] : []),
      ...(canMoveInDirection(index, 1) ? [{ name: 'moveLater', label: t('trainingAgenda.later') }] : []),
      ] : []),
    ];
    const content = <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, marginVertical: 2,
      backgroundColor: cardio ? (scheme === 'light' ? '#F1F5FA' : '#253343')
        : entry.kind === 'strength' ? colors.ambient : undefined }}>
      <Pressable accessibilityRole={entry.kind === 'rest' ? 'checkbox' : 'button'}
        accessibilityState={entry.kind === 'rest' ? { checked: entry.checked } : undefined}
        accessibilityLabel={entry.kind === 'rest' ? name : undefined}
        accessibilityActions={actions}
        onAccessibilityAction={actions.length ? event => {
          if (event.nativeEvent.actionName === 'moveEarlier') onAccessibleMove?.(entry.id, -1);
          if (event.nativeEvent.actionName === 'moveLater') onAccessibleMove?.(entry.id, 1);
          if (event.nativeEvent.actionName === 'removeRest') remove?.();
        } : undefined}
        disabled={entry.kind === 'rest' && !onToggleRest}
        onPress={() => entry.kind === 'rest' ? onToggleRest?.(entry) : onOpen(entry)}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 54, paddingHorizontal: 7, paddingVertical: 3 }}>
        <AgendaBadge entry={entry} />
        <View style={{ flex: 1 }}>
          {next && <Text style={{ color: colors.accentText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{t('trainingAgenda.next')}</Text>}
          <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700', textDecorationLine: skipped ? 'line-through' : 'none' }}>{name}</Text>
          {!!details.length && <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{details.filter(Boolean).join(' · ')}</Text>}
        </View>
      </Pressable>
      {canLink(entry) && <Pressable accessibilityRole="button" accessibilityLabel={t('trainingAgenda.linkHealth')}
        onPress={() => onLink(entry)} style={{ minHeight: 44, maxWidth: 88, paddingHorizontal: 4, justifyContent: 'center' }}>
        <Text style={{ color: ACCENTS.sky[scheme], fontSize: 12, fontWeight: '700', textAlign: 'right' }}>{t('trainingAgenda.linkHealth')}</Text>
      </Pressable>}
    </View>;
    return remove ? <SwipeableSet removeLabel={t('restDays.remove')} backgroundColor={colors.bgElevated} onRemove={remove}>
      {content}
    </SwipeableSet> : content;
  };
  return <>{[...groups].map(([group, entries]) => {
    const first = entries[0];
    const title = group && first.kind === 'cardio' ? first.session.block.proposal.name : t('trainingAgenda.title');
    const globalIndex = (index: number) => indexes.get(entries[index].id)!;
    return <View key={group ?? 'agenda'} style={{ marginTop: 18 }}>
      <Text accessibilityRole="header" style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.9,
        textTransform: 'uppercase', marginBottom: 8 }}>{title}</Text>
      <View style={{ ...surfaces.card, borderRadius: radius.lg, paddingHorizontal: 12 }}>
        <RoutineDayList items={entries} renderItem={row} onReorder={(from, to) => onReorder(globalIndex(from), globalIndex(to))}
          canDrag={canMove} canDrop={(entry, from, to) => canDrop(entry, globalIndex(from), globalIndex(to))}
          itemHeight={Math.ceil(64 * Math.max(1, fontScale))} edgeScroll={edgeScroll} />
        {!group && onAddRest && <Pressable accessibilityRole="button" accessibilityLabel={t('restDays.add')} onPress={onAddRest}
          style={{ minHeight: 46, justifyContent: 'center', borderTopWidth: 1, borderColor: colors.surfaceBorder }}>
          <Text style={{ color: colors.accentText, fontSize: 15, fontWeight: '700' }}>+ {t('calendar.rest')}</Text>
        </Pressable>}
      </View>
    </View>;
  })}</>;
}
