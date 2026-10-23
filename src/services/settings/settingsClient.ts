import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { AppSettingsRepository } from './appSettings';

export const appSettingsRepository = new AppSettingsRepository({
  read: async () => {
    if (Platform.OS === 'web') return localStorage.getItem('vigor-app-settings');
    const file = new File(Paths.document, 'vigor-app-settings.json'); return file.exists ? file.textSync() : null;
  },
  write: async (text) => {
    if (Platform.OS === 'web') { localStorage.setItem('vigor-app-settings', text); return; }
    const file = new File(Paths.document, 'vigor-app-settings.pending'); file.create({ overwrite: true }); file.write(text);
    file.move(new File(Paths.document, 'vigor-app-settings.json'), { overwrite: true });
  },
});
