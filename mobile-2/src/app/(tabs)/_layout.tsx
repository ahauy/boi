import React from 'react';
import { Tabs } from 'expo-router/js-tabs';

import CosmicTabBar from '../../components/CosmicTabBar';
import { colors } from '../../theme';

export default function TabsLayout() {
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
      <Tabs.Screen name="history" options={{ title: 'Lịch sử' }} />
      <Tabs.Screen name="profile" options={{ title: 'Hồ sơ' }} />
    </Tabs>
  );
}
