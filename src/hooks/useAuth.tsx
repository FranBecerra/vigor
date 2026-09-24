/**
 * Estado de sesión del usuario, disponible en cualquier pantalla.
 *
 * CAMBIO DE CRITERIO: antes este hook abría una sesión ANÓNIMA automáticamente
 * si no había ninguna. Ya no. Motivo: la API key de Firebase viaja en el binario
 * y es pública por diseño, así que un proveedor anónimo abierto permite crear
 * cuentas en bucle mediante script y amplificar el coste de escrituras. Ahora la
 * sesión SIEMPRE nace de una acción del usuario en la pantalla de acceso.
 *
 * Distingue explícitamente `isLoading` de "sin sesión": mientras Firebase
 * restaura la sesión del disco no se sabe aún si hay usuario, y pintar la
 * pantalla de login en ese hueco provocaría un parpadeo en cada arranque.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@react-native-firebase/auth';
import {
  SignInCancelledError,
  onAuthChange,
  signInAnonymously,
  signInWithGoogle,
  signOut,
} from '@/services/auth';

export interface AuthState {
  user: User | null;
  /** true mientras Firebase resuelve si hay sesión previa en disco. */
  isLoading: boolean;
  /** Operación de login en curso. */
  isSigningIn: boolean;
  /** Último error de login. `null` si la última operación fue bien o se canceló. */
  error: Error | null;
  /** uid del usuario, o null si no hay sesión. */
  uid: string | null;
  /** true si la sesión es anónima (sin credencial recuperable). */
  isAnonymous: boolean;
  signInWithGoogle: () => Promise<void>;
  continueWithoutAccount: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // El listener es la única fuente de verdad: se dispara tanto con una sesión
    // restaurada del disco como con una recién creada.
    const unsubscribe = onAuthChange((nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  /** Envuelve un login: gestiona el estado y trata la cancelación como no-error. */
  const runSignIn = useCallback(async (action: () => Promise<User>) => {
    setIsSigningIn(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      // Cancelar no es un fallo: el usuario cambió de opinión y no debe ver
      // un mensaje de error por ello.
      if (!(cause instanceof SignInCancelledError)) {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      }
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      isSigningIn,
      error,
      uid: user?.uid ?? null,
      isAnonymous: user?.isAnonymous ?? false,
      signInWithGoogle: () => runSignIn(signInWithGoogle),
      continueWithoutAccount: () => runSignIn(signInAnonymously),
      signOut: async () => {
        await signOut();
      },
    }),
    [user, isLoading, isSigningIn, error, runSignIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Estado de sesión. Lanza si se usa fuera del proveedor, para detectarlo pronto. */
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  }
  return context;
}
