import * as Haptics from 'expo-haptics';

// Bọc lỗi để web/Expo Go thiếu module haptics không làm hỏng thao tác chính.
export const haptic = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  select: () => Haptics.selectionAsync().catch(() => undefined),
  capture: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined),
};
