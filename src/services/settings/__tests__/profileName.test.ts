import { updateDisplayName } from '../profileName';
const mockUpdate = jest.fn(); let mockUser: any = { uid: 'owner' };
jest.mock('@react-native-firebase/auth', () => ({ updateProfile: (...args: unknown[]) => mockUpdate(...args) }));
jest.mock('@/services/firebase', () => ({ authInstance: { get currentUser() { return mockUser; } } }));
beforeEach(() => { mockUpdate.mockReset().mockResolvedValue(undefined); mockUser = { uid: 'owner' }; });
it('updates only the current authenticated display name after validation', async () => {
  expect(await updateDisplayName('owner', '  Fran  ')).toBe('Fran'); expect(mockUpdate).toHaveBeenCalledWith(mockUser, { displayName: 'Fran' });
  await expect(updateDisplayName('owner', '')).rejects.toThrow(); expect(mockUpdate).toHaveBeenCalledTimes(1);
});
it('guards logout/account switches before and during updates and propagates network failure', async () => {
  mockUser = null; await expect(updateDisplayName('owner', 'Fran')).rejects.toThrow('Account');
  mockUser = { uid: 'other' }; await expect(updateDisplayName('owner', 'Fran')).rejects.toThrow('Account');
  mockUser = { uid: 'owner' }; await expect(updateDisplayName('', 'Fran')).rejects.toThrow('Account');
  mockUpdate.mockImplementationOnce(async () => { mockUser = { uid: 'other' }; }); await expect(updateDisplayName('owner', 'Fran')).rejects.toThrow('Account');
  mockUser = { uid: 'owner' }; mockUpdate.mockRejectedValueOnce(Error('offline')); await expect(updateDisplayName('owner', 'Fran')).rejects.toThrow('offline');
});
