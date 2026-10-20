/** Display only an SDK error identifier, never credential-bearing native messages. */
export function authErrorPresentation(error: unknown): { messageKey: string; code: string | null } {
  const value = error !== null && typeof error === 'object' && 'code' in error ? error.code : null;
  const code = typeof value === 'string' && /^[a-zA-Z0-9_/-]{1,80}$/.test(value) ? value : null;
  const messageKey = code === 'auth/keychain-error'
    ? 'auth.keychainError'
    : code === 'auth/network-request-failed'
      ? 'auth.networkError'
      : 'auth.signInError';
  return { messageKey, code };
}
