/** Native iOS tabs use the system Liquid Glass material on iOS 26+. */
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { sectionAccent } = useTheme();

  return (
    <NativeTabs tintColor={sectionAccent.train}>
      <NativeTabs.Trigger name="(train)">
        <NativeTabs.Trigger.Label>{t('tabs.train')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'dumbbell', selected: 'dumbbell.fill' }} md="fitness_center" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bio">
        <NativeTabs.Trigger.Label>{t('tabs.bio')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="waveform.path.ecg" md="monitor_heart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="nutrition">
        <NativeTabs.Trigger.Label>{t('tabs.nutrition')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'fork.knife', selected: 'fork.knife' }} md="restaurant" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
