import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Appearance } from 'react-native';
import { useAuth } from './useAuth';
import i18n, { getSystemLanguage } from '@/i18n';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '@/services/settings/appSettings';
import { appSettingsRepository } from '@/services/settings/settingsClient';
import { updateDisplayName } from '@/services/settings/profileName';
import { TrainingUnitsContext } from './TrainingUnitsContext';
import { AccentContext } from '@/theme/AccentContext';
import { loadAudit } from '@/services/performance/loadAudit';
import { AthleteIntakeContext } from './AthleteIntakeContext';

interface SettingsContext {
  settings: AppSettings; ready: boolean; busy: boolean; error: boolean; displayName: string;
  change(patch: Partial<AppSettings>): Promise<boolean>; saveName(name: string): Promise<boolean>; reload(): void;
}
const Context = createContext<SettingsContext | null>(null);
export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { uid, user, isLoading } = useAuth(); const currentOwner = useRef(uid); currentOwner.current = uid;
  const lifecycle = useRef({ owner: uid, epoch: 0, mounted: true });
  if (lifecycle.current.owner !== uid) { lifecycle.current.owner = uid; lifecycle.current.epoch++; }
  useEffect(() => { lifecycle.current.mounted = true; return () => { lifecycle.current.mounted = false; lifecycle.current.epoch++; }; }, []);
  const [state, setState] = useState<{ owner: string | null; settings: AppSettings; ready: boolean; error: boolean }>({ owner: null, settings: { ...DEFAULT_APP_SETTINGS }, ready: false, error: false });
  const [name, setName] = useState<{ owner: string | null; value: string }>({ owner: null, value: '' });
  const [attempt, setAttempt] = useState(0); const [busyOwner, setBusyOwner] = useState<string | null>(null);
  const working = useRef(new Set<string>()); const appliedOwner = useRef<string | null>(null);
  const apply = (settings: AppSettings) => {
    Appearance.setColorScheme(settings.appearance === 'system' ? 'unspecified' : settings.appearance);
    const language = settings.language === 'system' ? getSystemLanguage() : settings.language;
    if (i18n.language !== language) void i18n.changeLanguage(language);
  };
  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    if (appliedOwner.current !== uid && appliedOwner.current !== null || uid === null) apply({ ...DEFAULT_APP_SETTINGS });
    appliedOwner.current = uid;
    if (!uid) { setState({ owner: null, settings: { ...DEFAULT_APP_SETTINGS }, ready: true, error: false }); return; }
    setState({ owner: uid, settings: { ...DEFAULT_APP_SETTINGS }, ready: false, error: false });
    loadAudit.measure('settings.read', () => appSettingsRepository.get(uid), 'mount').then((settings) => {
      if (!cancelled && currentOwner.current === uid) { setState({ owner: uid, settings, ready: true, error: false }); apply(settings); }
    }).catch(() => { if (!cancelled) setState({ owner: uid, settings: { ...DEFAULT_APP_SETTINGS }, ready: false, error: true }); });
    return () => { cancelled = true; };
  }, [uid, isLoading, attempt]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && state.owner === currentOwner.current && state.ready && state.settings.language === 'system') {
        void i18n.changeLanguage(getSystemLanguage());
      }
    });
    return () => subscription.remove();
  }, [state]);
  const visible = state.owner === uid && !isLoading ? state : { settings: { ...DEFAULT_APP_SETTINGS }, ready: false, error: false };
  const run = async (action: (owner: string, isCurrent: () => boolean) => Promise<void>) => {
    if (!uid || !visible.ready || working.current.has(uid)) return false;
    working.current.add(uid); setBusyOwner(uid);
    const epoch = lifecycle.current.epoch;
    const isCurrent = () => lifecycle.current.mounted && lifecycle.current.epoch === epoch && currentOwner.current === uid;
    try { await action(uid, isCurrent); return isCurrent(); }
    catch { if (isCurrent()) setState((old) => ({ ...old, error: true })); return false; }
    finally { working.current.delete(uid); if (lifecycle.current.mounted) setBusyOwner((owner) => owner === uid ? null : owner); }
  };
  return <Context.Provider value={{ ...visible, busy: busyOwner === uid && uid !== null,
    displayName: name.owner === uid ? name.value : user?.displayName ?? '',
    change: (patch) => run(async (owner, isCurrent) => {
      const settings = await appSettingsRepository.update(owner, patch);
      if (isCurrent()) { setState({ owner, settings, ready: true, error: false }); apply(settings); }
    }),
    saveName: (input) => run(async (owner, isCurrent) => {
      const value = await updateDisplayName(owner, input);
      if (isCurrent()) { setName({ owner, value }); setState((old) => ({ ...old, error: false })); }
    }), reload: () => setAttempt((value) => value + 1),
  }}><AthleteIntakeContext.Provider value={{ ready: visible.ready, error: visible.error, reload: () => setAttempt(value => value + 1), intake: visible.ready ? visible.settings.athleteIntake : undefined }}><AccentContext.Provider value={visible.settings.accent ?? 'lime'}><TrainingUnitsContext.Provider value={{ unit: visible.settings.measurementSystem === 'imperial' ? 'lb' : 'kg', increment: visible.settings.weightIncrement ?? 0.25 }}>{children}</TrainingUnitsContext.Provider></AccentContext.Provider></AthleteIntakeContext.Provider></Context.Provider>;
}
export function useAppSettings() {
  const settings = useContext(Context); if (!settings) throw Error('AppSettingsProvider missing'); return settings;
}
