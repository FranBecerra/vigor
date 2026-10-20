import { authErrorPresentation } from '../authError';

it('distinguishes local secure-storage errors from network failures', () => {
  expect(authErrorPresentation({ code: 'auth/keychain-error', message: 'private payload' }))
    .toEqual({ messageKey: 'auth.keychainError', code: 'auth/keychain-error' });
  expect(authErrorPresentation({ code: 'auth/network-request-failed' }).messageKey).toBe('auth.networkError');
  expect(authErrorPresentation({ code: 'auth/invalid-credential' }))
    .toEqual({ messageKey: 'auth.signInError', code: 'auth/invalid-credential' });
});
it('never exposes raw messages, arbitrary payloads or malformed error codes', () => {
  for (const value of [null, undefined, 'secret', 42, {}, new Error('token=secret'),
    { code: 17995 }, { code: '' }, { code: 'token=secret' }, { code: 'a'.repeat(81) }]) {
    expect(authErrorPresentation(value)).toEqual({ messageKey: 'auth.signInError', code: null });
  }
});
