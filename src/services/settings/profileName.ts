import { updateProfile } from '@react-native-firebase/auth';
import { authInstance } from '@/services/firebase';
import { normalizeDisplayName } from './appSettings';

/** Auth display name, not a globally reserved social handle. No fabricated user document. */
export async function updateDisplayName(owner: string, input: string): Promise<string> {
  const name = normalizeDisplayName(input); const user = authInstance.currentUser;
  if (!owner || user?.uid !== owner) throw Error('Account changed');
  await updateProfile(user, { displayName: name });
  if (authInstance.currentUser?.uid !== owner) throw Error('Account changed');
  return name;
}
