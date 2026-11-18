import { useTranslation } from 'react-i18next';
import { ActionMenuSheet } from './ActionMenuSheet';

export interface RoutineActions {
  name: string;
  active: boolean;
  activate(): void;
  edit(): void;
  remove(): void;
  removeDisabled?: boolean;
}

/** The same three actions are shown for all saved training plans. */
export function RoutineActionsSheet({ target, onClose }: { target: RoutineActions | null; onClose(): void }) {
  const { t } = useTranslation();
  return <ActionMenuSheet title={target?.name ?? null} onClose={onClose} actions={target ? [
    { label: target.active ? `${t('home.activateRoutine')} · ${t('home.activeRoutine')}` : t('home.activateRoutine'),
      onPress: target.activate, disabled: target.active },
    { label: t('routineEdit'), onPress: target.edit },
    { label: t('home.removeRoutine'), tone: 'danger', onPress: target.remove, disabled: target.removeDisabled },
  ] : []} />;
}
