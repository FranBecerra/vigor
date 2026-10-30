import { createContext, useCallback, useContext, useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
import { BackHandler, View } from 'react-native';

interface Entry { owner: symbol; content: ReactNode; dismiss(): void }
interface Host { show(entry: Entry): void; clear(owner: symbol): void }
const Context = createContext<Host | null>(null);
export const useWheelOverlay = () => useContext(Context);

/** Same native window: opening a wheel must not interrupt the finger that opened it. */
export function WheelOverlayProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const current = useRef<Entry | null>(null);
  const show = useCallback((value: Entry) => {
    if (current.current && current.current.owner !== value.owner) current.current.dismiss();
    current.current = value; setEntry(value);
  }, []);
  const clear = useCallback((owner: symbol) => {
    if (current.current?.owner === owner) { current.current = null; setEntry(null); }
  }, []);
  const host = useMemo(() => ({ show, clear }), [show, clear]);
  useEffect(() => {
    if (!entry) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { entry.dismiss(); return true; });
    return () => listener.remove();
  }, [entry]);
  return <Context.Provider value={host}><View style={{ flex: 1 }}>{children}
    {entry && <View testID="numeric-wheel-overlay" pointerEvents="box-none" style={{ position: 'absolute', inset: 0, zIndex: 10000 }}>{entry.content}</View>}
  </View></Context.Provider>;
}
