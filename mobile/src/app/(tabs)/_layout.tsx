import { NativeTabs } from 'expo-router/native-tabs';

import { colors } from '../../theme';

// SDK 58 dùng NativeTabs (tab bar native); `Tabs` kinh điển đã chuyển sang expo-router/js-tabs và deprecated.
// Icon: `sf` cho iOS, `md` cho Android (Material Symbols) — khỏi dựng asset PNG cho tab bar.
export default function TabsLayout() {
  return (
    <NativeTabs
      backgroundColor={colors.canvas}
      indicatorColor="rgba(212,175,55,0.18)"
      rippleColor="rgba(212,175,55,0.24)"
      tintColor={colors.gold}
      iconColor={{ default: colors.stone, selected: colors.gold }}
      labelStyle={{ default: { color: colors.stone }, selected: { color: colors.goldLight } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Xem bói</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="eye" md="visibility" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>Lịch sử</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" md="history" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Hồ sơ</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
