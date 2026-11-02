import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import Text from './AppText';
import { colors, shadow, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';

type TabName = 'index' | 'scan' | 'history' | 'profile';

const TAB_META: Record<TabName, { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  index: { label: 'Trang chủ', icon: 'home-variant-outline' },
  scan: { label: 'Quét', icon: 'line-scan' },
  history: { label: 'Lịch sử', icon: 'history' },
  profile: { label: 'Hồ sơ', icon: 'account-circle-outline' },
};

// 4 ô flex:1 bằng nhau nên khoảng cách giữa các tab đều nhau; Quét không còn là nút tròn nâng cao.
const TAB_ORDER: TabName[] = ['index', 'scan', 'history', 'profile'];

export default function CosmicTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  function routeFor(name: TabName) {
    return state.routes.find((route) => route.name === name);
  }

  function focus(name: TabName) {
    const route = routeFor(name);
    if (!route) return;
    const focused = state.routes[state.index]?.name === name;
    const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      haptic.select();
      navigateToTab(route.key);
    }
  }

  function tabButton(name: TabName) {
    const route = routeFor(name);
    if (!route) return null;
    const meta = TAB_META[name];
    const focused = state.routes[state.index]?.name === name;

    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityLabel={meta.label}
        accessibilityState={{ selected: focused }}
        aria-selected={focused}
        android_ripple={{ color: 'rgba(231,199,119,0.12)', borderless: true }}
        onPress={() => focus(name)}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 64,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          opacity: pressed ? 0.72 : 1,
        })}>
        <MaterialCommunityIcons accessible={false} name={meta.icon} size={23} color={focused ? colors.goldLight : colors.stone} />

        <Text
          style={[type.captionStrong, { color: focused ? colors.goldLight : colors.stone, fontSize: 11 }]}
          maxFontSizeMultiplier={1.15}
          numberOfLines={1}>
          {meta.label}
        </Text>

        {focused ? <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: colors.gold }} /> : <View style={{ height: 3 }} />}
      </Pressable>
    );
  }

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: 'transparent', zIndex: 30 }}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(4,6,17,0.55)', 'rgba(4,6,17,0.94)', 'rgba(4,6,17,1)']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 32,
          ...shadow.card,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          backgroundColor: colors.tabBar,
          paddingHorizontal: spacing.xs,
        }}>
        {TAB_ORDER.map(tabButton)}
      </View>
    </View>
  );
}
