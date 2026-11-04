import React, { useEffect } from 'react';
import { Tabs } from 'expo-router/js-tabs';

import CosmicTabBar from '../../components/CosmicTabBar';
import { colors } from '../../theme';
import { runStartupSequence } from '../../startup/startup-sequence';
import { useAuth } from '../../state/auth';

export default function TabsLayout() {
  const { user, status } = useAuth();

  useEffect(() => {
    void runStartupSequence({
      vipKnown: status === 'ready',
      isVip: Boolean(user?.vip?.active),
      billingOn: true,
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
      <Tabs.Screen name="index" options={{ title: 'Trang chủ' }} />
      <Tabs.Screen name="scan" options={{ title: 'Quét' }} />
      <Tabs.Screen name="currency" options={{ title: 'Gems' }} />
      <Tabs.Screen name="history" options={{ title: 'Lịch sử' }} />
      <Tabs.Screen name="profile" options={{ title: 'Hồ sơ' }} />
    </Tabs>
  );
}
