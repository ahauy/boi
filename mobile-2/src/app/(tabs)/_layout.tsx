import React, { useEffect } from 'react';
import { Tabs } from 'expo-router/js-tabs';

import CosmicTabBar from '../../components/CosmicTabBar';
import { colors } from '../../theme';
import { t, useI18n } from '../../i18n';
import { runStartupSequence } from '../../startup/startup-sequence';
import { useAuth } from '../../state/auth';

export default function TabsLayout() {
  useI18n();
  const { user, status } = useAuth();

  useEffect(() => {
    void runStartupSequence({
      vipKnown: status === 'ready',
      isVip: Boolean(user?.vip?.active),
    });
  }, [user, status]);

  return (
    <Tabs
      tabBar={(props) => <CosmicTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.canvas },
        animation: 'shift',
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="scan" options={{ title: t('tabs.scan') }} />
      <Tabs.Screen name="currency" options={{ title: t('tabs.gems') }} />
      <Tabs.Screen name="history" options={{ title: t('tabs.history') }} />
      <Tabs.Screen name="profile" options={{ title: t('profile.title') }} />
    </Tabs>
  );
}
