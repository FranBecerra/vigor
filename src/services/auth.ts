/**
 * Servicio de autenticación (Capa 2).
 *
 * PROVEEDORES
 *
 * - **Google** (`signInWithGoogle`): la vía principal hoy. Funciona con una
 *   cuenta de desarrollador de Apple gratuita, porque no necesita ninguna
 *   capability: el client ID sale del GoogleService-Info.plist y el URL scheme
 *   de iOS lo genera el config plugin desde `REVERSED_CLIENT_ID`.
 *
 * - **Apple** (`signInWithApple`): pendiente de la capability "Sign in with
 *   Apple", que exige cuenta de pago. El código está listo; solo falta devolver
 *   `usesAppleSignIn` a app.json y recompilar. Importa para publicar: la
 *   directriz 4.8 de la App Store obliga a ofrecer Apple si se ofrece Google.
 *
 * - **Anónimo** (`signInAnonymously`): NO es la puerta por defecto. Se ofrece
 *   como "probar sin cuenta" y solo si el usuario lo elige. Motivo: la API key
 *   de Firebase viaja en el binario —es pública por diseño—, así que un
 *   proveedor anónimo habilitado permite crear cuentas en bucle mediante script
 *   y amplificar el coste de escrituras. No es una brecha (las reglas siguen
 *   aislando los datos de cada uid), pero sí un vector de abuso de cuota.
 *
 * VINCULACIÓN: `linkWithGoogle` y `linkWithApple` convierten una sesión anónima
 * en una cuenta real CONSERVANDO el `uid`. Como todos los datos se indexan por
 * `uid`, el historial sobrevive. Es lo que permite "entrena ahora, regístrate
 * después" sin perder nada.
 */
import {
  AppleAuthProvider,
  GoogleAuthProvider,
  signInAnonymously as fbSignInAnonymously,
  signInWithCredential,
  linkWithCredential,
  signOut as fbSignOut,
  onAuthStateChanged,
  type AuthCredential,
  type User,
} from '@react-native-firebase/auth';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { authInstance } from './firebase';

/** Error que distingue una cancelación del usuario de un fallo real. */
export class SignInCancelledError extends Error {
  constructor() {
    super('El usuario canceló el inicio de sesión.');
    this.name = 'SignInCancelledError';
  }
}

/**
 * Configura Google Sign-In. Idempotente y perezosa: se llama antes de cada uso
 * en lugar de al arrancar la app, para no hacer trabajo si el usuario ya tiene
 * sesión guardada y nunca toca el botón.
 *
 * No se pasa `webClientId` a mano: con el plist presente, el SDK nativo lee el
 * cliente correcto. Escribirlo aquí duplicaría una fuente de verdad.
 */
let googleConfigured = false;
function configureGoogle(): void {
  if (googleConfigured) return;
  GoogleSignin.configure();
  googleConfigured = true;
}

/** Pide a Google una credencial de Firebase. Compartido por login y vinculación. */
async function requestGoogleCredential(): Promise<AuthCredential> {
  configureGoogle();
  await GoogleSignin.hasPlayServices();

  try {
    const response = await GoogleSignin.signIn();

    // La librería devuelve un resultado con `type: 'cancelled'` cuando el
    // usuario cierra el diálogo; no es un error que deba propagarse como fallo.
    if (response.type === 'cancelled') {
      throw new SignInCancelledError();
    }

    const idToken = response.data?.idToken;
    if (!idToken) {
      throw new Error('Google Sign-In falló: no se recibió idToken.');
    }
    return GoogleAuthProvider.credential(idToken);
  } catch (cause) {
    if (cause instanceof SignInCancelledError) throw cause;
    // Algunas versiones señalan la cancelación con un código en vez del tipo.
    if (
      typeof cause === 'object' &&
      cause !== null &&
      'code' in cause &&
      (cause as { code: unknown }).code === statusCodes.SIGN_IN_CANCELLED
    ) {
      throw new SignInCancelledError();
    }
    throw cause;
  }
}

/** Pide a Apple una credencial de Firebase. */
async function requestAppleCredential(): Promise<AuthCredential> {
  const response = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    // El nombre debe ir primero según la FAQ de la librería.
    requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
  });

  if (!response.identityToken) {
    throw new Error('Apple Sign-In falló: no se recibió identityToken.');
  }
  return AppleAuthProvider.credential(response.identityToken, response.nonce);
}

/** Inicia sesión con Google. */
export async function signInWithGoogle(): Promise<User> {
  const credential = await requestGoogleCredential();
  const result = await signInWithCredential(authInstance, credential);
  return result.user;
}

/** Inicia sesión con Apple (requiere la capability, cuenta de pago). */
export async function signInWithApple(): Promise<User> {
  const credential = await requestAppleCredential();
  const result = await signInWithCredential(authInstance, credential);
  return result.user;
}

/**
 * Sesión anónima, solo bajo petición explícita del usuario.
 * Si ya hay sesión la devuelve, en lugar de fabricar una segunda cuenta huérfana.
 */
export async function signInAnonymously(): Promise<User> {
  const existing = authInstance.currentUser;
  if (existing) return existing;
  const result = await fbSignInAnonymously(authInstance);
  return result.user;
}

/** Vincula la sesión actual (normalmente anónima) a una cuenta de Google. */
export async function linkWithGoogle(): Promise<User> {
  const current = authInstance.currentUser;
  if (!current) throw new Error('No hay sesión activa que vincular con Google.');
  const credential = await requestGoogleCredential();
  const result = await linkWithCredential(current, credential);
  return result.user;
}

/** Vincula la sesión actual a una cuenta de Apple, conservando el uid. */
export async function linkWithApple(): Promise<User> {
  const current = authInstance.currentUser;
  if (!current) throw new Error('No hay sesión activa que vincular con Apple.');
  const credential = await requestAppleCredential();
  const result = await linkWithCredential(current, credential);
  return result.user;
}

/** Cierra la sesión. También en Google, para que el próximo login vuelva a preguntar. */
export async function signOut(): Promise<void> {
  if (googleConfigured) {
    // Puede fallar si no hubo sesión de Google; no debe impedir cerrar la de Firebase.
    await GoogleSignin.signOut().catch(() => undefined);
  }
  await fbSignOut(authInstance);
}

/** Usuario actualmente autenticado, o null si no hay sesión. */
export function getCurrentUser(): User | null {
  return authInstance.currentUser;
}

/** true si la sesión actual es anónima (aún sin credencial recuperable). */
export function isAnonymousSession(): boolean {
  return authInstance.currentUser?.isAnonymous ?? false;
}

/**
 * Registra un listener del estado de autenticación.
 * Devuelve una función para cancelar la suscripción.
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(authInstance, callback);
}
